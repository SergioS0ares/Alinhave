"""
Rotas e lógica da API: salvar pessoas, upload de modelos e gerar documento.
CRUD completo para pessoas, modelos e documentos gerados.
"""
import io
import re
from datetime import datetime

import mammoth
from bson import ObjectId
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Body
from fastapi.responses import StreamingResponse, Response

from docxtpl import DocxTemplate
from docx import Document
from htmldocx import HtmlToDocx

from app.database import db
from app.models import PessoaModel

router = APIRouter()


# Campos de Pessoa que podem ser usados como variáveis nos modelos ({{ nome }}, {{ cpf }}, etc.)
CAMPOS_PESSOA = ["nome", "cpf", "email", "telefone", "endereco"]


@router.get("/pessoas/campos")
async def listar_campos_pessoa():
    """Retorna os nomes dos campos de pessoa para usar como variáveis no editor ({{ nome }}, etc.)."""
    return {"campos": CAMPOS_PESSOA}


@router.get("/pessoas")
async def listar_pessoas():
    """Retorna todas as pessoas cadastradas para a tabela do Angular."""
    cursor = db.pessoas.find({})
    pessoas = []
    async for doc in cursor:
        d = dict(doc)
        d["id"] = str(d["_id"])
        del d["_id"]
        pessoas.append(d)
    return pessoas


@router.get("/pessoas/{id}")
async def buscar_pessoa(id: str):
    """Retorna uma pessoa pelo ID (para edição)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    doc = await db.pessoas.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Pessoa não encontrada")
    doc = dict(doc)
    doc["id"] = str(doc["_id"])
    del doc["_id"]
    return doc


@router.post("/pessoas", status_code=201)
async def criar_pessoa(pessoa: PessoaModel):
    """
    Recebe o JSON do Angular e salva no banco.
    Retorna o ID gerado pelo MongoDB.
    """
    doc = pessoa.model_dump()
    result = await db.pessoas.insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.put("/pessoas/{id}")
async def atualizar_pessoa(id: str, pessoa: PessoaModel):
    """Atualiza os dados de uma pessoa (ex: mudou de endereço)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    result = await db.pessoas.update_one(
        {"_id": oid},
        {"$set": pessoa.model_dump()},
    )
    if result.matched_count == 0:
        raise HTTPException(404, detail="Pessoa não encontrada")
    return {"message": "Pessoa atualizada"}


@router.delete("/pessoas/{id}")
async def deletar_pessoa(id: str):
    """Deleta uma pessoa do banco."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    result = await db.pessoas.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, detail="Pessoa não encontrada")
    return {"message": "Pessoa removida com sucesso"}


@router.post("/modelos", status_code=201)
async def upload_modelo(
    arquivo: UploadFile = File(...),
    nome: str = Form(None),
):
    """
    Recebe um arquivo .docx (multipart/form-data).
    Salva no MongoDB: nome do template, data de upload e binário do arquivo.
    """
    if not arquivo.filename or not arquivo.filename.lower().endswith(".docx"):
        raise HTTPException(400, detail="Envie um arquivo .docx")
    conteudo = await arquivo.read()
    nome_template = nome or arquivo.filename
    doc = {
        "nome": nome_template,
        "data_upload": datetime.utcnow(),
        "arquivo": conteudo,  # bytes no MongoDB
    }
    result = await db.modelos.insert_one(doc)
    return {"id": str(result.inserted_id), "nome": nome_template}


@router.get("/modelos")
async def listar_modelos():
    """
    Retorna os modelos cadastrados (sem binário .docx nem HTML para não pesar).
    tipo: "docx" | "html" indica a origem do modelo.
    """
    cursor = db.modelos.find({}, {"arquivo": 0})
    modelos = []
    async for doc in cursor:
        d = dict(doc)
        d["id"] = str(d["_id"])
        del d["_id"]
        if d.get("data_upload"):
            d["data_upload"] = d["data_upload"].isoformat()
        d["tipo"] = "sfdt" if "sfdt" in doc else ("html" if "html" in doc else "docx")
        if "html" in d:
            del d["html"]
        if "sfdt" in d:
            del d["sfdt"]
        modelos.append(d)
    return modelos


@router.delete("/modelos/{id}")
async def deletar_modelo(id: str):
    """Deleta um modelo de documento."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    result = await db.modelos.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, detail="Modelo não encontrado")
    return {"message": "Modelo removido com sucesso"}


@router.post("/modelos/converter")
async def converter_docx_para_html(arquivo: UploadFile = File(...)):
    """
    Recebe o .docx do usuário, converte para HTML preservando parágrafos e negritos,
    e devolve para o Angular exibir no editor.
    """
    if not arquivo.filename or not arquivo.filename.lower().endswith(".docx"):
        raise HTTPException(400, detail="Envie um arquivo .docx")
    conteudo = await arquivo.read()
    docx_io = io.BytesIO(conteudo)
    resultado = mammoth.convert_to_html(docx_io)
    return {"html": resultado.value}


@router.post("/modelos/salvar-html", status_code=201)
async def salvar_modelo_html(body: dict = Body(...)):
    """Salva um modelo criado/editado no editor (apenas HTML). nome e html."""
    nome = body.get("nome")
    html = body.get("html", "")
    if not nome or not nome.strip():
        raise HTTPException(400, detail="Nome do modelo é obrigatório")
    doc = {
        "nome": nome.strip(),
        "html": html,
        "data_upload": datetime.utcnow(),
    }
    result = await db.modelos.insert_one(doc)
    return {"id": str(result.inserted_id), "nome": nome.strip()}


@router.put("/modelos/{id}/html")
async def atualizar_modelo_html(id: str, body: dict = Body(...)):
    """Atualiza o HTML de um modelo existente (criado pelo editor)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    modelo = await db.modelos.find_one({"_id": oid})
    if not modelo:
        raise HTTPException(404, detail="Modelo não encontrado")
    if "arquivo" in modelo:
        raise HTTPException(400, detail="Este modelo é um .docx enviado; não pode ser editado como HTML.")
    html = body.get("html", "")
    await db.modelos.update_one({"_id": oid}, {"$set": {"html": html, "data_upload": datetime.utcnow()}})
    return {"message": "Modelo atualizado"}


@router.post("/modelos/salvar-sfdt", status_code=201)
async def salvar_modelo_sfdt(body: dict = Body(...)):
    """Salva um modelo criado no editor Syncfusion (Word). nome e sfdt (JSON)."""
    nome = body.get("nome")
    sfdt = body.get("sfdt")
    if not nome or not nome.strip():
        raise HTTPException(400, detail="Nome do modelo é obrigatório")
    if sfdt is None:
        raise HTTPException(400, detail="Conteúdo do documento (sfdt) é obrigatório")
    doc = {
        "nome": nome.strip(),
        "sfdt": sfdt,
        "data_upload": datetime.utcnow(),
    }
    result = await db.modelos.insert_one(doc)
    return {"id": str(result.inserted_id), "nome": nome.strip()}


@router.put("/modelos/{id}/sfdt")
async def atualizar_modelo_sfdt(id: str, body: dict = Body(...)):
    """Atualiza o SFDT de um modelo existente (editor Syncfusion)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    modelo = await db.modelos.find_one({"_id": oid})
    if not modelo:
        raise HTTPException(404, detail="Modelo não encontrado")
    if "arquivo" in modelo:
        raise HTTPException(400, detail="Este modelo é .docx enviado; não pode ser editado aqui.")
    sfdt = body.get("sfdt")
    if sfdt is None:
        raise HTTPException(400, detail="Conteúdo (sfdt) é obrigatório")
    await db.modelos.update_one({"_id": oid}, {"$set": {"sfdt": sfdt, "data_upload": datetime.utcnow()}})
    return {"message": "Modelo atualizado"}


@router.post("/modelos/salvar-docx-from-html", status_code=201)
async def salvar_modelo_docx_from_html(body: dict = Body(...)):
    """Salva um modelo convertendo HTML para .docx (editor → DOCX)."""
    nome = body.get("nome")
    html = body.get("html", "")
    if not nome or not nome.strip():
        raise HTTPException(400, detail="Nome do modelo é obrigatório")
    conteudo = _html_to_docx_bytes(html)
    doc = {
        "nome": nome.strip(),
        "data_upload": datetime.utcnow(),
        "arquivo": conteudo,
    }
    result = await db.modelos.insert_one(doc)
    return {"id": str(result.inserted_id), "nome": nome.strip()}


@router.put("/modelos/{id}/docx-from-html")
async def atualizar_modelo_docx_from_html(id: str, body: dict = Body(...)):
    """Atualiza um modelo .docx a partir do HTML do editor."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    modelo = await db.modelos.find_one({"_id": oid})
    if not modelo:
        raise HTTPException(404, detail="Modelo não encontrado")
    if "arquivo" not in modelo and "html" not in modelo:
        raise HTTPException(400, detail="Modelo inválido")
    html = body.get("html", "")
    conteudo = _html_to_docx_bytes(html)
    await db.modelos.update_one(
        {"_id": oid},
        {"$set": {"arquivo": conteudo, "data_upload": datetime.utcnow()}, "$unset": {"html": ""}},
    )
    return {"message": "Modelo atualizado"}


@router.get("/modelos/{id}")
async def buscar_modelo(id: str):
    """Retorna um modelo (para edição). Para .docx converte para HTML com mammoth."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    doc = await db.modelos.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Modelo não encontrado")
    d = dict(doc)
    d["id"] = str(d["_id"])
    del d["_id"]
    if d.get("data_upload"):
        d["data_upload"] = d["data_upload"].isoformat()
    if "arquivo" in d:
        resultado = mammoth.convert_to_html(io.BytesIO(d["arquivo"]))
        d["html"] = resultado.value
        del d["arquivo"]
    return d


@router.get("/modelos/{id}/download")
async def download_modelo(id: str):
    """Retorna o modelo como arquivo .docx para download (a partir de HTML ou do binário)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    doc = await db.modelos.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Modelo não encontrado")
    nome_arquivo = f"{doc.get('nome', 'modelo').replace(' ', '_')}.docx"
    if doc.get("html"):
        conteudo = _html_to_docx_bytes(doc["html"])
        return Response(
            content=conteudo,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
        )
    if doc.get("arquivo"):
        return Response(
            content=doc["arquivo"],
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{nome_arquivo}"'},
        )
    raise HTTPException(422, detail="Modelo sem conteúdo para download")


def _substituir_placeholders(html: str, contexto: dict) -> str:
    """Substitui {{ chave }} pelo valor em contexto (para modelos HTML)."""
    def replacer(match):
        key = match.group(1).strip()
        return str(contexto.get(key, match.group(0)))
    return re.sub(r"\{\{\s*([^}]+)\s*\}\}", replacer, html)


def _html_to_docx_bytes(html: str) -> bytes:
    """Converte HTML para bytes de um arquivo .docx."""
    doc = Document()
    parser = HtmlToDocx()
    parser.add_html_to_document(html or "<p></p>", doc)
    buffer = io.BytesIO()
    doc.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


@router.get("/gerar-documento/{pessoa_id}/{modelo_id}")
async def gerar_documento(pessoa_id: str, modelo_id: str):
    """
    Gera o documento (docx ou html conforme o modelo), salva em documentos_gerados
    e retorna o arquivo para download.
    """
    try:
        pid = ObjectId(pessoa_id)
        mid = ObjectId(modelo_id)
    except Exception:
        raise HTTPException(400, detail="IDs inválidos")

    pessoa_doc = await db.pessoas.find_one({"_id": pid})
    if not pessoa_doc:
        raise HTTPException(404, detail="Pessoa não encontrada")
    modelo_doc = await db.modelos.find_one({"_id": mid})
    if not modelo_doc:
        raise HTTPException(404, detail="Modelo não encontrado")

    nome_pessoa = pessoa_doc.get("nome", "documento")
    nome_modelo = modelo_doc.get("nome", "modelo")
    contexto = {k: v for k, v in pessoa_doc.items() if k != "_id"}

    # Modelo com HTML (editor): substitui variáveis e converte para DOCX
    if "html" in modelo_doc:
        html_gerado = _substituir_placeholders(modelo_doc["html"], contexto)
        conteudo_docx = _html_to_docx_bytes(html_gerado)
        doc_gerado = {
            "pessoa_id": pid,
            "modelo_id": mid,
            "nome_pessoa": nome_pessoa,
            "nome_modelo": nome_modelo,
            "data_geracao": datetime.utcnow(),
            "tipo": "docx",
            "conteudo": conteudo_docx,
        }
        result = await db.documentos_gerados.insert_one(doc_gerado)
        nome_arquivo = f"documento_{nome_pessoa.replace(' ', '_')}.docx"
        return Response(
            content=conteudo_docx,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
                "X-Document-Id": str(result.inserted_id),
            },
        )
    # Modelo .docx
    arquivo_bytes = modelo_doc.get("arquivo")
    if not arquivo_bytes:
        raise HTTPException(422, detail="Modelo sem arquivo nem HTML")

    template = DocxTemplate(io.BytesIO(arquivo_bytes))
    template.render(contexto)
    buffer = io.BytesIO()
    template.save(buffer)
    buffer.seek(0)
    conteudo_gerado = buffer.getvalue()

    doc_gerado = {
        "pessoa_id": pid,
        "modelo_id": mid,
        "nome_pessoa": nome_pessoa,
        "nome_modelo": nome_modelo,
        "data_geracao": datetime.utcnow(),
        "tipo": "docx",
        "conteudo": conteudo_gerado,
    }
    result = await db.documentos_gerados.insert_one(doc_gerado)

    nome_arquivo = f"documento_{nome_pessoa.replace(' ', '_')}.docx"
    return Response(
        content=conteudo_gerado,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{nome_arquivo}"',
            "X-Document-Id": str(result.inserted_id),
        },
    )


# ---------- Documentos gerados (histórico + visualizar + apagar) ----------


@router.get("/documentos-gerados")
async def listar_documentos_gerados():
    """Lista os documentos já gerados (sem o conteúdo binário/html)."""
    cursor = db.documentos_gerados.find({}, {"conteudo": 0, "html": 0})
    docs = []
    async for doc in cursor:
        d = dict(doc)
        d["id"] = str(d["_id"])
        del d["_id"]
        if d.get("data_geracao"):
            d["data_geracao"] = d["data_geracao"].isoformat()
        d["pessoa_id"] = str(d["pessoa_id"])
        d["modelo_id"] = str(d["modelo_id"])
        docs.append(d)
    return docs


@router.get("/documentos-gerados/{id}/visualizar")
async def visualizar_documento_gerado(id: str):
    """Retorna o documento em HTML para visualização no navegador."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    doc = await db.documentos_gerados.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Documento não encontrado")
    if doc.get("tipo") == "html" and doc.get("html"):
        return {"html": doc["html"]}
    if doc.get("tipo") == "docx" and doc.get("conteudo"):
        resultado = mammoth.convert_to_html(io.BytesIO(doc["conteudo"]))
        return {"html": resultado.value}
    raise HTTPException(422, detail="Conteúdo não disponível para visualização")


@router.get("/documentos-gerados/{id}/download")
async def download_documento_gerado(id: str):
    """Faz download do documento (docx ou html)."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    doc = await db.documentos_gerados.find_one({"_id": oid})
    if not doc:
        raise HTTPException(404, detail="Documento não encontrado")
    nome_base = f"documento_{doc.get('nome_pessoa', 'doc').replace(' ', '_')}"
    if doc.get("tipo") == "html":
        return Response(
            content=doc.get("html", "").encode("utf-8"),
            media_type="text/html; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{nome_base}.html"'},
        )
    return Response(
        content=doc.get("conteudo", b""),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{nome_base}.docx"'},
    )


@router.delete("/documentos-gerados/{id}")
async def deletar_documento_gerado(id: str):
    """Remove um documento gerado do histórico."""
    try:
        oid = ObjectId(id)
    except Exception:
        raise HTTPException(400, detail="ID inválido")
    result = await db.documentos_gerados.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(404, detail="Documento não encontrado")
    return {"message": "Documento removido com sucesso"}
