# 🎨 DesignSystemExtractor

> Extrai e analisa o design system de sites concorrentes automaticamente — cores, tipografia, espaçamentos e mais — com inteligência artificial.

Chega de abrir DevTools em dez abas diferentes pra entender como a concorrência trabalha visualmente. O **DesignSystemExtractor** raspa os sites da sua lista, extrai os tokens de design e usa o **Claude** pra sintetizar os padrões — tudo isso rodando automaticamente via **GitHub Actions**.

---

## ✨ O que ele faz

Dado um arquivo `sites.txt` com uma lista de URLs, o extrator:

1. Acessa cada site e extrai os elementos visuais — paleta de cores, tipografia, espaçamentos, sombras, border-radius e outros tokens CSS.
2. Processa e estrutura os dados extraídos em um formato comparável entre os sites.
3. Usa o **Claude** para analisar e gerar insights sobre as escolhas de design de cada marca.
4. Roda automaticamente via **GitHub Actions**, sem precisar rodar nada na sua máquina.

---

## 🏦 Sites monitorados (padrão)

O repositório já vem configurado com um conjunto de fintechs de referência:

| Site | Segmento |
|---|---|
| `stripe.com` | Pagamentos global |
| `nubank.com.br` | Banco digital BR |
| `stone.com.br` | Pagamentos BR |
| `neofin.com.br` | Fintech B2B BR |
| `abacatepay.com` | Pagamentos BR |
| `mercadopago.com.br` | Pagamentos BR |

Adicionar ou remover sites é só editar o `sites.txt` — uma URL por linha.

---

## 🛠️ Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js |
| Scraping / Extração | JavaScript |
| Análise com IA | [Claude (Anthropic)](https://www.anthropic.com/) |
| Automação | GitHub Actions |
| Configuração de alvos | `sites.txt` |

---

## 🚀 Como usar

### 1. Configure suas credenciais

No repositório (fork ou clone), vá em **Settings → Secrets and variables → Actions** e adicione:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 2. Edite a lista de sites

Abra o `sites.txt` e coloque os sites que quer analisar. Linhas com `#` são ignoradas.

```txt
# Lista de sites para extração de design system
stripe.com
nubank.com.br
seusite.com.br
```

### 3. Rode o extrator

O workflow do GitHub Actions dispara automaticamente ao fazer push. Para rodar manualmente, vá em **Actions → (workflow) → Run workflow**.

### 4. Consulte os resultados

Os outputs são gerados e salvos como artefatos do workflow, disponíveis direto na aba **Actions** do GitHub.

---

## 📁 Estrutura do projeto

```
DesignSystemExtractor/
├── .github/
│   └── workflows/       # Pipeline de automação (GitHub Actions)
├── extractor/           # Lógica principal de scraping e extração
├── sites.txt            # Lista de URLs alvo
└── README.md
```

---

## 💡 Casos de uso

- **Pesquisa de mercado** — entenda como os players do seu setor estruturam a identidade visual.
- **Benchmarking de design** — compare tokens entre concorrentes de forma sistemática.
- **Auditoria de consistência** — verifique se um site segue seu próprio design system.
- **Referência para novos projetos** — colete referências reais antes de começar a criar.

---

## ⚠️ Aviso

Este projeto é desenvolvido para fins de pesquisa e uso interno. O uso de web scraping em sites de terceiros pode estar sujeito aos Termos de Serviço dessas plataformas. Use com responsabilidade.

---

<p align="center">Feito com ☕ por <a href="https://github.com/raphaelrpais">raphaelrpais</a></p>
