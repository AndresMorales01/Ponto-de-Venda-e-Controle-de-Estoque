# MercadoPro — Sistema de PDV e Controle de Estoque

Projeto reconstruído a partir das telas presentes no TCC. A interface foi mantida próxima ao material apresentado e a versão agora possui backend e banco de dados SQLite.

## Tecnologias

- HTML5
- CSS3
- JavaScript
- Node.js
- Express
- SQLite
- sql.js (SQLite em WebAssembly, sem compilação nativa)

## Funcionalidades

### Cadastro
- Cadastrar produto
- Editar produto
- Buscar produto
- Código de barras
- Categoria e unidade
- Preço de custo e venda
- Estoque atual e estoque mínimo
- Produto ativo/inativo

### PDV
- Busca por código de barras
- Quantidade
- Carrinho/cupom
- Subtotal
- Desconto
- Total
- Forma de pagamento
- Valor pago
- Troco
- Finalização da venda
- Baixa automática no estoque
- Validação de estoque

## Banco de dados

O arquivo `mercadopro.db` é criado automaticamente na primeira execução. A aplicação usa `sql.js`, então não é necessário compilar módulos nativos.

Tabelas:
- `products`
- `sales`
- `sale_items`

## Como executar

É necessário ter Node.js instalado.

No terminal, dentro da pasta do projeto:

```bash
npm install
npm start
```

Depois abra:

```text
http://localhost:3000
```

Para desenvolvimento:

```bash
npm run dev
```

## Colocar no GitHub

1. Crie ou abra o repositório:
   `https://github.com/AndresMorales01/Ponto-de-Venda-e-Controle-de-Estoque`
2. Coloque todos os arquivos deste projeto no repositório.
3. Não envie `node_modules` nem `mercadopro.db`; eles já estão no `.gitignore`.
4. Faça o commit e push.

Exemplo:

```bash
git add .
git commit -m "Implementa PDV e controle de estoque"
git push
```

## Observação importante

O código original foi perdido. Portanto esta é uma reconstrução funcional baseada nas telas e descrições disponíveis no TCC. Não é possível garantir que reproduza funcionalidades que não aparecem no material, como NFC-e, impressora fiscal, login ou integração com equipamentos.
