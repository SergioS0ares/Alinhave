import { Component, inject, signal, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Api, type Pessoa } from '../../services/api';

@Component({
  selector: 'app-pessoas',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './pessoas.html',
  styleUrl: './pessoas.scss',
})
export class Pessoas implements OnInit {
  private api = inject(Api);
  private fb = inject(FormBuilder);

  dataSource = new MatTableDataSource<Pessoa>([]);
  displayedColumns = ['nome', 'cpf', 'acoes'];
  showForm = signal(false);
  editingId = signal<string | null>(null);
  loading = signal(false);
  saving = signal(false);

  /** Padrão email: algo@algo.algo */
  private static EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  form = this.fb.group({
    nome: ['', Validators.required],
    cpf: ['', [Validators.required, Validators.pattern(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/)]],
    email: ['', Validators.pattern(Pessoas.EMAIL_PATTERN)],
    telefone: [''],
    endereco: [''],
  });

  ngOnInit(): void {
    this.carregar();
  }

  carregar(): void {
    this.loading.set(true);
    this.api.getPessoas().subscribe({
      next: (list) => {
        this.dataSource.data = list;
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  novaPessoa(): void {
    this.editingId.set(null);
    this.showForm.set(true);
    this.form.reset();
  }

  editar(row: Pessoa): void {
    if (!row.id) return;
    this.editingId.set(row.id);
    this.showForm.set(true);
    this.form.patchValue({
      nome: row.nome,
      cpf: row.cpf,
      email: row.email ?? '',
      telefone: row.telefone ?? '',
      endereco: row.endereco ?? '',
    });
  }

  cancelar(): void {
    this.showForm.set(false);
    this.editingId.set(null);
    this.form.reset();
  }

  salvar(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    const value = this.form.getRawValue();
    const body = {
      nome: value.nome!,
      cpf: value.cpf!,
      email: value.email || undefined,
      telefone: value.telefone || undefined,
      endereco: value.endereco || undefined,
    };
    const id = this.editingId();
    const onDone = () => {
      this.saving.set(false);
      this.cancelar();
      this.carregar();
    };
    if (id) {
      this.api.updatePessoa(id, body).subscribe({ next: onDone, error: () => this.saving.set(false) });
    } else {
      this.api.createPessoa(body).subscribe({ next: onDone, error: () => this.saving.set(false) });
    }
  }

  /** Máscara CPF: 000.000.000-00 */
  formatarCpf(): void {
    const ctrl = this.form.get('cpf');
    if (!ctrl) return;
    const v = (ctrl.value || '').replace(/\D/g, '').slice(0, 11);
    let formatted: string;
    if (v.length <= 3) formatted = v;
    else if (v.length <= 6) formatted = v.slice(0, 3) + '.' + v.slice(3);
    else if (v.length <= 9) formatted = v.slice(0, 3) + '.' + v.slice(3, 6) + '.' + v.slice(6);
    else formatted = v.slice(0, 3) + '.' + v.slice(3, 6) + '.' + v.slice(6, 9) + '-' + v.slice(9, 11);
    ctrl.setValue(formatted, { emitEvent: false });
  }

  /** Máscara telefone: (00) 00000-0000 */
  formatarTelefone(): void {
    const ctrl = this.form.get('telefone');
    if (!ctrl) return;
    const v = (ctrl.value || '').replace(/\D/g, '').slice(0, 11);
    let formatted: string;
    if (v.length <= 2) formatted = v ? `(${v})` : '';
    else if (v.length <= 6) formatted = `(${v.slice(0, 2)}) ${v.slice(2)}`;
    else formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
    ctrl.setValue(formatted, { emitEvent: false });
  }

  excluir(row: Pessoa): void {
    if (!row.id) return;
    if (!confirm(`Excluir ${row.nome}?`)) return;
    this.api.deletePessoa(row.id).subscribe({
      next: () => this.carregar(),
    });
  }
}
