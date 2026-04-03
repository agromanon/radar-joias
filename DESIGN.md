# Design System: Radar Leilão (Airbnb Dark Mode)

## 1. Visual Theme & Atmosphere
Uma interface SaaS de alto nível inspirada na suavidade e foco do **Airbnb**, mas adaptada para um escuro elegante (Dark Mode). O ambiente deve ser acolhedor, espaçoso e muito fácil de usar. Sai o visual "Terminal Industrial" e entra um visual mais humanizado. Uso intenso de espaços em branco (white-space), componentes arredondados grandes e amigáveis, e o roxo vibrante do Discord (`#5865F2`) para guiar a atenção do usuário de forma moderna e "Gamer/Tech".

## 2. Color Palette & Roles
- **Canvas Dark** (#0B0E14) — Fundo principal, escuro mas suave (não preto absoluto).
- **Surface Elevation 1** (#151A22) — Fundo de cards, modais e containers flutuantes.
- **Midnight Purple** (#2F3136) — Fundo de inputs, botões secundários (estilo canais do Discord).
- **Discord Blurple** (#5865F2) — Cor Principal de Ação (Primary Accent). Botões CTAs, links e estados ativos.
- **Pure White** (#FFFFFF) — Textos principais e títulos.
- **Cool Grey** (#8E9297) — Textos secundários, descrições e ícones inativos.

## 3. Typography Rules
- **Família Principal:** `Inter` ou `Outfit` — Fontes modernas, limpas, geométricas e altamente legíveis.
- **Hierarquia:** Guiada pelo tamanho da fonte e peso. Títulos grandes e expressivos (estilo Airbnb) em SemiBold.
- Em tabelas ou números cruciais de leilão, usar font-variant-numeric: tabular-nums.
- **Banned:** Geist (se tornou muito técnica), fontes serifadas.

## 4. Component Stylings
* **Buttons:** Amigáveis, cantos bastante arredondados (`rounded-xl` ou `rounded-full`). O botão primário recebe o Blurple (#5865F2) com texto branco e um leve glow/sombra roxa no hover.
* **Cards:** Cantos suaves e generosos (`rounded-2xl`). Uso de "Plush Shadows" (sombras difusas longas no Dark Mode escurecendo a base) para separar camadas em vez de bordas duras de 1px.
* **Inputs/Filters:** Estilo "pílula" de pesquisa (como a barra de busca do Airbnb). Fundo Midnight Purple, sem bordas marcadas. focus trigger revela um anel Discord Blurple.
* **Imagens:** Devem ter cantos arredondados e preencher graciosamente os cards do lote.
* **Data Presentation:** Grid estruturado mas com bastante respiro (padding `p-6`). Remover linhas divisórias pesadas, usar `gap` e espaço negativo.

## 5. Layout Principles
- Centralizado ou em Grid amigável (semelhante à busca de casas do Airbnb).
- **Sidebar Vertical:** A navegação será fixada na lateral esquerda (estilo Discord/SaaS) em oposição ao Top Nav. O menu flutuante ou expansivo lateral abriga as buscas, perfil, e painel de controle admin.
- Não entulhar a tela com dados (Banned: data-density terminal). A informação precisa respirar. O leilão deve parecer uma oportunidade agradável, não um pregão da bolsa de valores sob estresse.

## 6. Motion & Interaction
- Animações super fluidas (spring-based). Ao abrir um lote, o modal ou a página deslizam suavemente.
- Hover states em todos os cards interativos (leve "lift" ou scale up de 2% para indicar clicabilidade).

## 7. Anti-Patterns (Banned)
- Sem estética de terminal financeiro (Banned: Brutalism, Monospace em excesso, quadrados perfeitos).
- Sem cores chapadas neons como Verde Esmeralda agressivo.
- Sem bordas grossas ou estilos 1px ásperos e duros de divisórias de tabela.
- Sem design de dados apertado e denso.
