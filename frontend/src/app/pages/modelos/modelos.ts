import { Component, inject, signal, OnInit, viewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Api, type Modelo } from '../../services/api';

@Component({
  selector: 'app-modelos',
  imports: [
    FormsModule,
    DatePipe,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './modelos.html',
  styleUrl: './modelos.scss',
})
export class Modelos implements OnInit, AfterViewChecked {
  private api = inject(Api);
  editorRef = viewChild<ElementRef<HTMLDivElement>>('editorDiv');

  /** Conteúdo HTML do editor (binding com a div contenteditable). */
  documentoHtml = signal('');
  /** HTML pendente para carregar no editor (após getModelo ou import .docx). */
  private htmlParaCarregar: string | null = null;

  modelos = signal<Modelo[]>([]);
  loading = signal(false);
  uploading = signal(false);
  error = signal<string | null>(null);
  modoEditor = signal(false);
  editandoId = signal<string | null>(null);
  nomeModelo = signal('');
  salvando = signal(false);
  variaveis = signal<{ chave: string; label: string }[]>([]);
  /** ID do modelo sendo visualizado no modal */
  visualizandoModelo = signal<string | null>(null);
  htmlVisualizacao = signal<string | null>(null);
  carregandoPreview = signal(false);

  private static LABELS: Record<string, string> = {
    nome: 'Nome',
    cpf: 'CPF',
    email: 'E-mail',
    telefone: 'Telefone',
    endereco: 'Endereço',
  };

  ngOnInit(): void {
    this.carregar();
    this.api.getCamposPessoa().subscribe({
      next: (r) => {
        this.variaveis.set(
          r.campos.map((chave) => ({ chave, label: Modelos.LABELS[chave] ?? chave }))
        );
      },
    });
  }

  ngAfterViewChecked(): void {
    if (this.htmlParaCarregar !== null) {
      const el = this.editorRef()?.nativeElement;
      if (el) {
        el.innerHTML = this.htmlParaCarregar;
        this.documentoHtml.set(this.htmlParaCarregar);
        this.htmlParaCarregar = null;
      }
    }
  }

  carregar(): void {
    this.loading.set(true);
    this.api.getModelos().subscribe({
      next: (list) => {
        this.modelos.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  readonly placeholderHtml = '<p>Insira suas variáveis clicando nos botões ao lado. Comece a redigir o seu modelo de documento aqui.</p>';

  novoModelo(): void {
    this.editandoId.set(null);
    this.nomeModelo.set('');
    this.documentoHtml.set(this.placeholderHtml);
    this.htmlParaCarregar = this.placeholderHtml;
    this.modoEditor.set(true);
  }

  editarModelo(m: Modelo): void {
    if (m.tipo === 'sfdt') return;
    this.editandoId.set(m.id);
    this.nomeModelo.set(m.nome);
    this.modoEditor.set(true);
    this.api.getModelo(m.id).subscribe({
      next: (modelo) => {
        const html = modelo.html ?? '<p></p>';
        this.htmlParaCarregar = html;
        this.documentoHtml.set(html);
      },
    });
  }

  /** Aplica formatação no editor (document.execCommand). */
  aplicarFormato(cmd: string, value?: string): void {
    this.editorRef()?.nativeElement?.focus();
    document.execCommand(cmd, false, value ?? '');
    this.onEditorInput();
  }

  inserirVariavel(tag: string): void {
    const el = this.editorRef()?.nativeElement;
    if (!el) {
      this.documentoHtml.update((h) => h + tag);
      return;
    }
    el.focus();
    const sel = window.getSelection();
    let range: Range | null = null;
    if (sel && sel.rangeCount) range = sel.getRangeAt(0);
    const noEditor = !range || !el.contains(range.commonAncestorContainer);
    if (noEditor) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    if (range) {
      range.deleteContents();
      const tn = document.createTextNode(tag);
      range.insertNode(tn);
      range.setStartAfter(tn);
      range.setEndAfter(tn);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    this.documentoHtml.set(el.innerHTML);
  }

  onEditorInput(): void {
    const el = this.editorRef()?.nativeElement;
    if (el) this.documentoHtml.set(el.innerHTML);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file?.name?.toLowerCase().endsWith('.docx')) this.abrirEditorComDocx(file);
    input.value = '';
  }

  /** Arrastar ou selecionar .docx: converte para HTML e abre o editor (novo modelo). */
  abrirEditorComDocx(file: File): void {
    this.error.set(null);
    this.uploading.set(true);
    this.api.converterDocxParaHtml(file).subscribe({
      next: (r) => {
        const html = r.html || '<p></p>';
        const nome = file.name.replace(/\.docx$/i, '').trim() || 'Novo modelo';
        this.editandoId.set(null);
        this.nomeModelo.set(nome);
        this.documentoHtml.set(html);
        this.htmlParaCarregar = html;
        this.modoEditor.set(true);
        this.uploading.set(false);
      },
      error: () => this.uploading.set(false),
    });
  }

  uploadDocxNoEditor(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file?.name.toLowerCase().endsWith('.docx')) {
      this.error.set('Envie um arquivo .docx');
      return;
    }
    input.value = '';
    this.error.set(null);
    this.uploading.set(true);
    this.api.converterDocxParaHtml(file).subscribe({
      next: (r) => {
        const html = r.html || '<p></p>';
        this.documentoHtml.set(html);
        this.htmlParaCarregar = html;
        this.uploading.set(false);
        const el = this.editorRef()?.nativeElement;
        if (el) el.innerHTML = html;
      },
      error: () => this.uploading.set(false),
    });
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file?.name?.toLowerCase().endsWith('.docx')) this.abrirEditorComDocx(file);
    else this.error.set('Envie apenas um arquivo .docx');
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  enviarArquivo(file: File): void {
    if (!file.name.toLowerCase().endsWith('.docx')) {
      this.error.set('Apenas arquivos .docx são aceitos.');
      return;
    }
    this.error.set(null);
    this.uploading.set(true);
    this.api.uploadModelo(file).subscribe({
      next: () => {
        this.uploading.set(false);
        this.carregar();
      },
      error: () => this.uploading.set(false),
    });
  }

  triggerFileInput(): void {
    document.getElementById('modelo-file-input')?.click();
  }

  triggerUploadDocxInEditor(): void {
    document.getElementById('upload-docx-editor')?.click();
  }

  onDropEditor(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer?.files?.[0];
    if (file?.name?.toLowerCase().endsWith('.docx')) {
      this.uploading.set(true);
      this.error.set(null);
      this.api.converterDocxParaHtml(file).subscribe({
        next: (r) => {
          const html = r.html || '<p></p>';
          this.documentoHtml.set(html);
          this.htmlParaCarregar = html;
          this.uploading.set(false);
          const el = this.editorRef()?.nativeElement;
          if (el) el.innerHTML = html;
        },
        error: () => this.uploading.set(false),
      });
    }
  }

  salvarModelo(): void {
    const nome = this.nomeModelo().trim();
    if (!nome) {
      this.error.set('Digite um nome para o modelo.');
      return;
    }
    this.error.set(null);
    this.salvando.set(true);
    const el = this.editorRef()?.nativeElement;
    const html = el ? el.innerHTML : this.documentoHtml();
    const id = this.editandoId();
    const onDone = () => {
      this.salvando.set(false);
      this.voltarLista();
    };
    if (id) {
      this.api.atualizarModeloDocxFromHtml(id, html).subscribe({ next: onDone, error: () => this.salvando.set(false) });
    } else {
      this.api.salvarModeloDocxFromHtml(nome, html).subscribe({ next: onDone, error: () => this.salvando.set(false) });
    }
  }

  voltarLista(): void {
    this.modoEditor.set(false);
    this.editandoId.set(null);
    this.htmlParaCarregar = null;
    this.carregar();
  }

  excluir(m: Modelo): void {
    if (!confirm(`Excluir o modelo "${m.nome}"?`)) return;
    this.api.deleteModelo(m.id).subscribe({
      next: () => this.carregar(),
    });
  }

  baixarModelo(m: Modelo): void {
    this.api.downloadModelo(m.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${(m.nome || 'modelo').replace(/\s+/g, '_')}.docx`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  visualizarModelo(m: Modelo): void {
    this.visualizandoModelo.set(m.id);
    this.htmlVisualizacao.set(null);
    this.carregandoPreview.set(true);
    this.api.getModelo(m.id).subscribe({
      next: (modelo) => {
        this.htmlVisualizacao.set(modelo.html ?? '<p></p>');
        this.carregandoPreview.set(false);
      },
      error: () => this.carregandoPreview.set(false),
    });
  }

  fecharVisualizacao(): void {
    this.visualizandoModelo.set(null);
    this.htmlVisualizacao.set(null);
  }
}
