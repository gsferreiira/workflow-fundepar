import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'dev-dist', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: 'detect' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // O projeto usa React 18 com novo JSX transform — não precisa importar React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // Aspas/apóstrofos em texto JSX (pt-BR) — puro ruído, não é erro real
      'react/no-unescaped-entities': 'off',
      // Permite variáveis iniciadas com _ ou maiúsculas (ex.: componentes não usados)
      'no-unused-vars': ['warn', { varsIgnorePattern: '^[A-Z_]' }],
      // Regras novas do react-hooks v7 (orientadas ao React Compiler): valiosas como
      // alerta, mas disparam em padrões legítimos do código atual. Mantidas como warn
      // para não travar o lint, deixando os erros reservados a problemas concretos.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
]
