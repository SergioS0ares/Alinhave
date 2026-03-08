import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable, firstValueFrom } from 'rxjs';

const API_URL = 'http://127.0.0.1:8000';

export interface Pessoa {
  id?: string;
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  endereco?: string;
}

export interface Modelo {
  id: string;
  nome: string;
  data_upload?: string;
  tipo?: 'docx' | 'html' | 'sfdt';
  html?: string;
  sfdt?: object;
}

export interface DocumentoGerado {
  id: string;
  pessoa_id: string;
  modelo_id: string;
  nome_pessoa: string;
  nome_modelo: string;
  data_geracao: string;
  tipo: 'docx' | 'html';
}

@Injectable({
  providedIn: 'root',
})
export class Api {
  constructor(private http: HttpClient) {}

  getPessoas(): Observable<Pessoa[]> {
    return this.http.get<Pessoa[]>(`${API_URL}/pessoas`);
  }

  getPessoa(id: string): Observable<Pessoa> {
    return this.http.get<Pessoa>(`${API_URL}/pessoas/${id}`);
  }

  createPessoa(pessoa: Omit<Pessoa, 'id'>): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${API_URL}/pessoas`, pessoa);
  }

  updatePessoa(id: string, pessoa: Omit<Pessoa, 'id'>): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${API_URL}/pessoas/${id}`, pessoa);
  }

  deletePessoa(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/pessoas/${id}`);
  }

  getModelos(): Observable<Modelo[]> {
    return this.http.get<Modelo[]>(`${API_URL}/modelos`);
  }

  uploadModelo(arquivo: File, nome?: string): Observable<{ id: string; nome: string }> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    if (nome) form.append('nome', nome);
    return this.http.post<{ id: string; nome: string }>(`${API_URL}/modelos`, form);
  }

  deleteModelo(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/modelos/${id}`);
  }

  getModelo(id: string): Observable<Modelo> {
    return this.http.get<Modelo>(`${API_URL}/modelos/${id}`);
  }

  /** Baixa o modelo como arquivo .docx */
  downloadModelo(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/modelos/${id}/download`, { responseType: 'blob' });
  }

  converterDocxParaHtml(arquivo: File): Observable<{ html: string }> {
    const form = new FormData();
    form.append('arquivo', arquivo);
    return this.http.post<{ html: string }>(`${API_URL}/modelos/converter`, form);
  }

  salvarModeloHtml(nome: string, html: string): Observable<{ id: string; nome: string }> {
    return this.http.post<{ id: string; nome: string }>(`${API_URL}/modelos/salvar-html`, { nome, html });
  }

  atualizarModeloHtml(id: string, html: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${API_URL}/modelos/${id}/html`, { html });
  }

  /** Salva modelo convertendo HTML para .docx (novo modelo). */
  salvarModeloDocxFromHtml(nome: string, html: string): Observable<{ id: string; nome: string }> {
    return this.http.post<{ id: string; nome: string }>(`${API_URL}/modelos/salvar-docx-from-html`, { nome, html });
  }

  /** Atualiza modelo .docx a partir do HTML do editor. */
  atualizarModeloDocxFromHtml(id: string, html: string): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${API_URL}/modelos/${id}/docx-from-html`, { html });
  }

  salvarModeloSfdt(nome: string, sfdt: object): Observable<{ id: string; nome: string }> {
    return this.http.post<{ id: string; nome: string }>(`${API_URL}/modelos/salvar-sfdt`, { nome, sfdt });
  }

  atualizarModeloSfdt(id: string, sfdt: object): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${API_URL}/modelos/${id}/sfdt`, { sfdt });
  }

  getCamposPessoa(): Observable<{ campos: string[] }> {
    return this.http.get<{ campos: string[] }>(`${API_URL}/pessoas/campos`);
  }

  getDocumentosGerados(): Observable<DocumentoGerado[]> {
    return this.http.get<DocumentoGerado[]>(`${API_URL}/documentos-gerados`);
  }

  visualizarDocumentoGerado(id: string): Observable<{ html: string }> {
    return this.http.get<{ html: string }>(`${API_URL}/documentos-gerados/${id}/visualizar`);
  }

  downloadDocumentoGerado(id: string): Observable<Blob> {
    return this.http.get(`${API_URL}/documentos-gerados/${id}/download`, { responseType: 'blob' });
  }

  deleteDocumentoGerado(id: string): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${API_URL}/documentos-gerados/${id}`);
  }

  gerarDocumento(pessoaId: string, modeloId: string): Observable<HttpResponse<Blob>> {
    return this.http.get(`${API_URL}/gerar-documento/${pessoaId}/${modeloId}`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  /** Gera o documento, salva no backend e retorna o id e tipo (vem no header X-Document-Id). */
  gerarDocumentoECard(pessoaId: string, modeloId: string): Observable<{ id: string; tipo: 'docx' | 'html' }> {
    return new Observable((sub) => {
      this.gerarDocumento(pessoaId, modeloId).subscribe({
        next: (res) => {
          const id = res.headers.get('X-Document-Id');
          if (!id) {
            sub.error(new Error('Backend não retornou ID do documento'));
            return;
          }
          const tipo: 'docx' | 'html' = (res.headers.get('Content-Type') || '').includes('wordprocessingml') ? 'docx' : 'html';
          sub.next({ id, tipo });
          sub.complete();
        },
        error: (err) => sub.error(err),
      });
    });
  }
}
