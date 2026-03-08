# Alinhave

Aplicação desenvolvida para otimizar a criação de documentos personalizados a partir de modelos pré-definidos. O projeto utiliza Angular no frontend para gestão de cadastros e Python (FastAPI) no backend para o processamento e preenchimento dinâmico de templates Office.

---

## Tecnologias

### Backend (Python)

| Biblioteca      | Uso                                      |
|-----------------|------------------------------------------|
| python-dotenv   | Variáveis de ambiente (.env)             |
| FastAPI         | API REST                                 |
| Uvicorn         | Servidor ASGI                            |
| Motor           | Driver assíncrono MongoDB                 |
| Pydantic        | Validação de dados                       |
| python-multipart| Upload de arquivos (multipart/form-data) |
| docxtpl         | Preenchimento de templates .docx (Jinja2) |
| python-docx     | Criação/edição de documentos Word        |
| Mammoth         | Conversão .docx → HTML                   |
| htmldocx        | Conversão HTML → .docx                   |
| Beautiful Soup 4| Parsing de HTML                          |

### Frontend (Angular)

| Biblioteca / Pacote              | Uso                          |
|----------------------------------|------------------------------|
| Angular 21 (core, forms, router) | Framework SPA                |
| Angular Material                 | Componentes de UI            |
| Angular CDK                      | Componentes de acessibilidade|
| Angular Animations               | Animações                    |
| CKEditor 5 (Angular + Decoupled Document) | Editor de texto rico  |
| Syncfusion Document Editor       | Editor tipo Word             |
| docx-preview                     | Visualização de .docx no navegador |
| RxJS                             | Programação reativa          |

### Dev (Frontend)

| Pacote        | Uso              |
|---------------|------------------|
| Angular CLI   | Build e scripts  |
| TypeScript    | Linguagem        |
| Vitest        | Testes           |
| Prettier      | Formatação       |
| jsdom         | Ambiente de testes |
