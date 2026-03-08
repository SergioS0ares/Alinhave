import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { renderAsync } from 'docx-preview';
import { Api, type DocumentoGerado } from '../../services/api';

@Component({
  selector: 'app-documentos-gerados',
  imports: [DatePipe, MatButtonModule, MatCardModule, MatIconModule],
  templateUrl: './documentos-gerados.html',
  styleUrls: ['./documentos-gerados.scss'],
})
export class DocumentosGerados implements OnInit {
  private api = inject(Api);
  private sanitizer = inject(DomSanitizer);

  documentos = signal<DocumentoGerado[]>([]);
  loading = signal(false);
  visualizandoId = signal<string | null>(null);
  /** 'docx' | 'html' – tipo do documento em visualização. */
  visualizandoTipo = signal<'docx' | 'html' | null>(null);
  htmlVisualizacao = signal<SafeHtml | null>(null);
  carregandoPreview = signal(false);

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.api.getDocumentosGerados().subscribe({
      next: (list) => {
        this.documentos.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  visualizar(d: DocumentoGerado): void {
    this.visualizandoId.set(d.id);
    this.visualizandoTipo.set(d.tipo);
    this.htmlVisualizacao.set(null);
    this.carregandoPreview.set(true);

    if (d.tipo === 'docx') {
      this.api.downloadDocumentoGerado(d.id).subscribe({
        next: (blob) => {
          this.carregandoPreview.set(false);
          setTimeout(() => {
            const el = document.getElementById('docx-preview-container');
            if (el) {
              el.innerHTML = '';
              renderAsync(blob, el).catch(() => {});
            }
          }, 50);
        },
        error: () => this.carregandoPreview.set(false),
      });
    } else {
      this.api.visualizarDocumentoGerado(d.id).subscribe({
        next: (r) => {
          this.htmlVisualizacao.set(this.sanitizer.bypassSecurityTrustHtml(r.html));
          this.carregandoPreview.set(false);
        },
        error: () => this.carregandoPreview.set(false),
      });
    }
  }

  fecharVisualizacao(): void {
    this.visualizandoId.set(null);
    this.visualizandoTipo.set(null);
    this.htmlVisualizacao.set(null);
    const el = document.getElementById('docx-preview-container');
    if (el) el.innerHTML = '';
  }

  download(d: DocumentoGerado): void {
    this.api.downloadDocumentoGerado(d.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const ext = d.tipo === 'html' ? 'html' : 'docx';
        a.download = `documento_${d.nome_pessoa.replace(/\s/g, '_')}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  extensao(d: DocumentoGerado): string {
    return d.tipo === 'html' ? 'HTML' : 'DOCX';
  }

  excluir(d: DocumentoGerado): void {
    if (!confirm(`Remover este documento do histórico?`)) return;
    this.api.deleteDocumentoGerado(d.id).subscribe({
      next: () => {
        if (this.visualizandoId() === d.id) this.fecharVisualizacao();
        this.carregar();
      },
    });
  }
}
