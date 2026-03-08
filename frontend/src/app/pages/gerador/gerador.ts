import { Component, inject, signal, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { Api, type Pessoa, type Modelo } from '../../services/api';

@Component({
  selector: 'app-gerador',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatSelectModule,
  ],
  templateUrl: './gerador.html',
  styleUrl: './gerador.scss',
})
export class Gerador implements OnInit {
  private api = inject(Api);
  private fb = inject(FormBuilder);

  pessoas = signal<Pessoa[]>([]);
  modelos = signal<Modelo[]>([]);
  loadingPessoas = signal(false);
  loadingModelos = signal(false);
  gerando = signal(false);

  form = this.fb.group({
    pessoaId: [null as string | null, null],
    modeloId: [null as string | null, null],
  });

  ngOnInit(): void {
    this.carregarPessoas();
    this.carregarModelos();
  }

  carregarPessoas(): void {
    this.loadingPessoas.set(true);
    this.api.getPessoas().subscribe({
      next: (list) => {
        this.pessoas.set(list);
        this.loadingPessoas.set(false);
      },
      error: () => this.loadingPessoas.set(false),
    });
  }

  carregarModelos(): void {
    this.loadingModelos.set(true);
    this.api.getModelos().subscribe({
      next: (list) => {
        this.modelos.set(list.filter((m) => m.tipo === 'docx' || m.tipo === 'html'));
        this.loadingModelos.set(false);
      },
      error: () => this.loadingModelos.set(false),
    });
  }

  /** Documento recém gerado (mostrado como card com botão de download). */
  documentoGeradoAgora = signal<{
    id: string;
    nome_pessoa: string;
    nome_modelo: string;
    data_geracao: string;
    tipo: 'docx' | 'html';
  } | null>(null);

  gerar(): void {
    const pid = this.form.value.pessoaId;
    const mid = this.form.value.modeloId;
    if (!pid || !mid) return;
    const pessoa = this.pessoas().find((p) => p.id === pid);
    const modelo = this.modelos().find((m) => m.id === mid);
    this.gerando.set(true);
    this.documentoGeradoAgora.set(null);
    this.api.gerarDocumentoECard(pid, mid).subscribe({
      next: ({ id, tipo }) => {
        this.gerando.set(false);
        this.documentoGeradoAgora.set({
          id,
          nome_pessoa: pessoa?.nome ?? 'Documento',
          nome_modelo: modelo?.nome ?? 'Modelo',
          data_geracao: new Date().toISOString(),
          tipo,
        });
      },
      error: () => this.gerando.set(false),
    });
  }

  baixarDocumentoGerado(doc: { id: string; nome_pessoa: string; nome_modelo: string; tipo: 'docx' | 'html' }): void {
    this.api.downloadDocumentoGerado(doc.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `documento_${doc.nome_pessoa.replace(/\s/g, '_')}.${doc.tipo === 'html' ? 'html' : 'docx'}`;
        a.click();
        URL.revokeObjectURL(url);
      },
    });
  }

  get podeGerar(): boolean {
    const v = this.form.value;
    return !!v.pessoaId && !!v.modeloId && !this.gerando();
  }
}
