# Juris Prudence Design System

## Visão Geral
Sistema de design profissional para gestão financeira jurídica, enfatizando autoridade, confiança e clareza.

---

## Paleta de Cores

### Cores Primárias

#### Navy Blue (#0A192F)
**Uso:** Autoridade, confiança, profissionalismo
- Headers, botões primários, texto principal, sidebar
- HSL: `210 100% 12%`
- Classe Tailwind: `bg-primary`, `text-primary`

#### Gold (#D4AF37)
**Uso:** Excelência, valor, elegância
- CTAs (Call-to-Actions), estados ativos, acentos
- HSL: `45 72% 53%`
- Classe Tailwind: `bg-accent`, `text-accent`

#### Slate Gray (#64748B)
**Uso:** Neutralidade profissional
- Texto secundário, estados desabilitados
- HSL: `215 20% 55%`
- Classe Tailwind: `bg-secondary`, `text-secondary`

### Backgrounds

#### White (#FFFFFF)
**Uso:** Clareza, limpeza
- Cards, modais, áreas de conteúdo
- HSL: `0 0% 100%`
- Classe Tailwind: `bg-background`

#### Off-White (#F8FAFC)
**Uso:** Backgrounds alternativos sutis
- Seções alternadas, estados hover suaves
- HSL: `210 40% 98%`
- Classe Tailwind: `bg-muted`

### Cores Semânticas

#### Success (#16a34a)
**Uso:** Verde - positivo, pago
- Status "Paga", indicadores de sucesso
- HSL: `142 76% 36%`
- Classe Tailwind: `bg-success`, `text-success`

#### Warning (#f59e0b)
**Uso:** Âmbar - pendente, atenção
- Status "Em aberto", alertas
- HSL: `38 92% 50%`
- Classe Tailwind: `bg-warning`, `text-warning`

#### Danger (#ef4444)
**Uso:** Vermelho - erros, vencido
- Status "Vencida", mensagens de erro
- HSL: `0 84% 60%`
- Classe Tailwind: `bg-danger`, `text-danger`

---

## Tipografia

### Famílias de Fontes

#### Playfair Display (Serif)
**Uso:** Títulos, headings (h1-h6)
- Tradição, elegância, autoridade
- Pesos: 400, 600, 700, 800, 900
- Classe Tailwind: `font-serif`

#### Inter (Sans-serif)
**Uso:** Corpo, parágrafos, labels, UI
- Legibilidade, modernidade, clareza
- Pesos: 400, 500, 600, 700
- Classe Tailwind: `font-sans`

### Escala Tipográfica

- **H1:** 48px (3rem) - line-height: 1.2
- **H2:** 36px (2.25rem) - line-height: 1.3
- **H3:** 30px (1.875rem) - line-height: 1.4
- **H4:** 24px (1.5rem) - line-height: 1.4
- **Body:** 16px (1rem) - line-height: 1.5
- **Small:** 14px (0.875rem) - line-height: 1.5

### Hierarquia

Todos os headings (h1-h6) automaticamente usam:
- Font-family: Playfair Display
- Font-weight: 700
- Color: Navy (#0A192F)

---

## Espaçamento

Base de grid de **4px**:
- 4px (0.25rem)
- 8px (0.5rem)
- 12px (0.75rem)
- 16px (1rem)
- 24px (1.5rem)
- 32px (2rem)
- 48px (3rem)
- 64px (4rem)

Use classes Tailwind: `p-4`, `m-6`, `gap-4`, etc.

---

## Border Radius

**Padrão:** 4px (0.25rem) - Corporativo, não muito arredondado

- `rounded` → 4px
- `rounded-md` → 3px
- `rounded-sm` → 2px

Classes CSS:
- `--radius: 0.25rem`

---

## Sombras

### Soft Shadow
**Uso:** Cards, botões padrão
```css
box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
```
Classe: `shadow-soft`

### Medium Shadow
**Uso:** Elementos em destaque, hover states
```css
box-shadow: 0 4px 12px 0 rgba(0, 0, 0, 0.08);
```
Classe: `shadow-medium`

### Gold Shadow
**Uso:** CTAs com destaque especial
```css
box-shadow: 0 4px 16px 0 rgba(212, 175, 55, 0.2);
```
Classe: `shadow-gold`

---

## Componentes

### Botões

#### Primary Button (Default)
- Background: Navy (#0A192F)
- Text: White
- Padding: 12px 24px (h-10 px-6)
- Border Radius: 4px
- Hover: Shadow medium + scale(1.02)
- Classe: `<Button variant="default">`

#### Accent Button (CTA)
- Background: Gold (#D4AF37)
- Text: Navy (#0A192F)
- Padding: 12px 24px
- Border Radius: 4px
- Hover: Shadow gold + scale(1.02)
- Classe: `<Button variant="accent">`

#### Secondary Button
- Background: Transparent
- Border: 1px solid Slate
- Text: Navy
- Hover: Background muted
- Classe: `<Button variant="secondary">`

#### Outline Button
- Background: Transparent
- Border: 1px solid border
- Hover: Background accent, text accent-foreground
- Classe: `<Button variant="outline">`

### Cards

- Background: White
- Border: 1px solid border (#e2e8f0)
- Border Radius: 4px
- Padding: 24px
- Shadow: Soft (0 1px 3px rgba(0,0,0,0.1))
- Hover: Shadow medium
- Título: Playfair Display, bold, navy

Exemplo:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>
    Conteúdo
  </CardContent>
</Card>
```

### Inputs & Forms

#### Input Fields
- Background: White
- Border: 1px solid input (#e2e8f0)
- Border Radius: 4px
- Padding: 10px 12px
- Focus: Border navy, ring 2px gold
- Placeholder: Slate gray muted

#### Labels
- Font: Inter, 600, 14px
- Color: Navy
- Classe: `<Label>`

#### Select Dropdowns
- Same as inputs
- Focus states: Navy border, gold ring

### Status Badges

#### Paga (Paid)
- Background: `bg-success/10`
- Text: `text-success`
- Border: `border-success`

#### Em aberto (Open)
- Background: `bg-warning/10`
- Text: `text-warning`
- Border: `border-warning`

#### Vencida (Overdue)
- Background: `bg-danger/10`
- Text: `text-danger`
- Border: `border-danger`

Formato: Pill com `rounded-full`, padding `px-3 py-1`, texto `text-xs font-semibold`

### Tables

- Headers: Background muted, text navy, font-weight 600
- Rows: Alternadas (white / off-white opcional)
- Hover: Background muted
- Border radius: 4px

### Dialogs/Modals

- Overlay: Semi-transparente escuro
- Card: White background, border, shadow medium
- Título: Playfair Display, bold, navy (text-xl)
- Botão primário: Accent variant (gold)
- Botão cancelar: Secondary variant

---

## Layout

### Sidebar/Navbar
- Background: Navy (#0A192F)
- Text: White
- Active states: Gold text ou background gold/15% opacity
- Border: Gold com 20% opacity (`rgba(212, 175, 55, 0.2)`)

### Main Content Area
- Background: Muted (#F8FAFC)
- Padding: 24px (p-6)

### Seções Alternadas
- Seção 1: Background white
- Seção 2: Background off-white (#F8FAFC)
- Seção 3: Background white
(Criar ritmo visual)

---

## Animações & Transições

### Transições Globais
- Duration: **200ms**
- Timing: **ease**

Aplicado automaticamente a:
- Todos elementos (`*`): `transition-duration: 200ms`
- Botões, links, inputs: `transition-all`

### Hover Effects
- Sombra suave → média
- Scale: `scale(1.02)` para botões
- Background color changes suaves

### Focus States
- Outline: 2px gold ring
- Border: Navy
- Sempre visível para acessibilidade

---

## Acessibilidade

### Contrastes (WCAG AA Compliance)

✅ **Navy (#0A192F) on White:** 15.5:1 (AAA)
✅ **Gold (#D4AF37) on Navy:** 4.8:1 (AA)
✅ **White on Navy:** 15.5:1 (AAA)
✅ **Slate (#64748B) on White:** 4.7:1 (AA)

### Keyboard Navigation
- Focus states visíveis (gold ring)
- Tab order lógico
- Escape fecha modais

### Screen Readers
- Labels em todos inputs
- Aria-labels onde apropriado
- Semantic HTML (h1-h6, button, etc.)

---

## Responsividade

### Breakpoints (Tailwind)
- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px
- `2xl:` 1536px

### Mobile-First Approach
- Padding reduzido em mobile (p-4)
- Padding aumentado em desktop (p-6, p-8)
- Tipografia responsiva:
  - H1: 36px mobile → 48px desktop
  - H2: 28px mobile → 36px desktop

### Layout Responsivo
- Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-4`
- Sidebar: Colapsável em mobile
- Tables: Scroll horizontal em mobile

---

## Uso de Classes Utilitárias

### Cores
```tsx
// Backgrounds
bg-primary     // Navy
bg-accent      // Gold
bg-secondary   // Slate
bg-muted       // Off-white
bg-success     // Green
bg-warning     // Amber
bg-danger      // Red

// Text
text-primary
text-accent
text-success
// ... etc
```

### Tipografia
```tsx
font-serif     // Playfair Display (títulos)
font-sans      // Inter (corpo)
font-semibold  // 600
font-bold      // 700
```

### Sombras
```tsx
shadow-soft    // Cards
shadow-medium  // Hover, destaque
shadow-gold    // CTAs especiais
```

---

## Exemplos de Uso

### Page Header
```tsx
<h1 className="text-3xl font-serif font-bold text-navy mb-2">
  Dashboard
</h1>
<p className="text-muted-foreground">
  Bem-vindo ao sistema
</p>
```

### Card com Dados
```tsx
<Card>
  <CardHeader>
    <CardTitle>Total de Receitas</CardTitle>
  </CardHeader>
  <CardContent>
    <p className="text-2xl font-bold text-success">
      R$ 150.000,00
    </p>
  </CardContent>
</Card>
```

### Formulário
```tsx
<div className="space-y-4">
  <div>
    <Label>Nome do Cliente</Label>
    <Input placeholder="Digite o nome" />
  </div>
  <div className="flex gap-2">
    <Button variant="secondary">Cancelar</Button>
    <Button variant="accent">Salvar</Button>
  </div>
</div>
```

### Status Badge
```tsx
<StatusBadge status="P" /> // Paga - verde
<StatusBadge status="A" /> // Em aberto - âmbar
<StatusBadge status="V" /> // Vencida - vermelho
```

---

## Princípios de Design

1. **Minimalismo Corporativo:** Remover elementos desnecessários, manter apenas o essencial
2. **Espaço em Branco:** Não preencher tudo; deixar respirar (generous padding/margin)
3. **Hierarquia Clara:** Playfair para títulos, Inter para corpo; cores guiam a atenção
4. **Consistência:** Mesmas cores, espaçamentos e raios em todo o app
5. **Elegância Discreta:** Dourado como acento, não como cor dominante (80% navy/white, 20% gold)
6. **Acessibilidade Primeiro:** Contraste suficiente, focus states, semantic HTML

---

## Integração com Bibliotecas

### Ant Design
Overrides aplicados em `globals.css`:
- Botões primários: Navy background
- Tables: Headers muted, hover muted
- Pagination: Active items gold

### Mantine UI
Navbar usa Mantine components com overrides inline:
- ThemeIcon: Gold background (rgba(212, 175, 55, 0.15))
- Links: Gold hover

### Recharts
Cores de gráficos mapeadas para:
- chart-1: Green (receitas)
- chart-2: Navy
- chart-3: Gold
- chart-4: Slate
- chart-5: Red (despesas)

---

## Manutenção

### Adicionando Novas Cores
1. Adicionar CSS variable em `globals.css` `:root`
2. Adicionar ao `tailwind.config.ts` em `theme.extend.colors`
3. Documentar neste arquivo

### Adicionando Novos Componentes
1. Seguir padrão shadcn/ui (forwardRef, variants)
2. Usar CVA para variantes
3. Aplicar design tokens (colors, shadows, radius)
4. Documentar neste arquivo

---

**Versão:** 1.0
**Última Atualização:** 2026-01-29
**Desenvolvido para:** ERP-Adv - Sistema Financeiro Jurídico
