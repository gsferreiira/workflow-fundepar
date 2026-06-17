export const DOMINIOS = ['TI', 'Mobiliário', 'Eletrodoméstico', 'Outros']

export const CATEGORIAS_POR_DOMINIO = {
  TI: [
    'Desktop', 'Notebook', 'Monitor', 'Impressora', 'Scanner',
    'Projetor', 'Tablet', 'Servidor', 'Switch/Roteador', 'Nobreak', 'Outros TI',
  ],
  Mobiliário: [
    'Mesa', 'Cadeira', 'Armário', 'Estante', 'Arquivo',
    'Sofá', 'Balcão', 'Quadro Branco', 'Outros Mobiliário',
  ],
  Eletrodoméstico: [
    'Ar-condicionado', 'Frigobar', 'Microondas', 'Bebedouro', 'Outros Eletrodoméstico',
  ],
  Outros: ['Outros'],
}

// Roles que enxergam todos os domínios (sem filtro)
export const ROLES_FULL_ACCESS = ['admin', 'patrimonio']

export const DOMINIO_ICONS = {
  TI: '🖥️',
  Mobiliário: '🪑',
  Eletrodoméstico: '⚡',
  Outros: '📦',
}
