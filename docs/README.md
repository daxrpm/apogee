# Apogee Documentation

Documentation for the Apogee rocket ascent simulator, built with [MkDocs](https://www.mkdocs.org/) and [mkdocs-shadcn](https://asiffer.github.io/mkdocs-shadcn/) theme.

## Quick Start

```bash
# Install dependencies
cd docs
uv venv
uv pip install mkdocs mkdocs-shadcn pymdown-extensions

# Serve locally
uv run mkdocs serve

# Build for production
uv run mkdocs build
```

## Structure

```
docs/
├── mkdocs.yml           # MkDocs configuration (shadcn theme)
├── pyproject.toml       # Python dependencies
├── nm_final_project.tex # LaTeX source for mathematical formulation
├── content/             # Markdown source files
│   ├── index.md         # Landing page
│   ├── getting-started/ # Installation & quick start
│   ├── theory/          # Mathematical derivations (★)
│   ├── numerical-methods/ # Algorithm explanations (★)
│   ├── packages/        # API reference
│   ├── frontend/        # React Three Fiber docs
│   └── reference/       # Constants, specs, bibliography
└── site/                # Built HTML (generated)
```

## Features

- **Step-by-step mathematical derivations** for all physics equations
- **Code-to-equation mapping** linking theory to implementation
- **Official academic references** for all numerical methods
- **Full API documentation** for all packages
- **KaTeX math rendering** with custom macros (built into shadcn)

## Math Rendering

Equations are rendered using KaTeX (built into mkdocs-shadcn). Custom macros are defined in `mkdocs.yml` under `theme.katex_options.macros`.

## Deployment

```bash
# Deploy to GitHub Pages
uv run mkdocs gh-deploy
```

## Theme

Using [mkdocs-shadcn](https://asiffer.github.io/mkdocs-shadcn/) - a beautiful, modern theme with:
- Dark/light mode
- KaTeX math rendering
- Syntax highlighting
- Admonitions
- Responsive design
