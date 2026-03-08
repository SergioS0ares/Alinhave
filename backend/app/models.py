"""
Estruturas da Pessoa e do Modelo (Pydantic).
Define as regras do que pode entrar no banco.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PessoaModel(BaseModel):
    """Dados da pessoa para salvar no banco e usar no documento."""
    nome: str
    cpf: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    # Adicione outros campos que o seu template .docx usar

    class Config:
        json_schema_extra = {
            "example": {
                "nome": "João da Silva",
                "cpf": "123.456.789-00",
                "email": "joao@email.com",
                "telefone": "(11) 99999-9999",
                "endereco": "Rua Exemplo, 123"
            }
        }


class ModeloDocModel(BaseModel):
    """Estrutura do modelo de documento no banco (após upload)."""
    nome: str  # Nome do template
    data_upload: datetime = Field(default_factory=datetime.utcnow)
    # O binário do arquivo .docx fica em um campo separado ao inserir (não vem no Pydantic de entrada)
