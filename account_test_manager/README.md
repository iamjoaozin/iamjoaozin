# Account Test Manager

## Painel React NORDLYS

O painel visual moderno unifica a automacao, o console ao vivo e os relatorios
CSV de sucessos e erros. Toda a automacao continua usando as funcoes existentes
em `mac_proxy_ui_poc.py`.

Para abrir sem janela de terminal, execute:

```text
abrir_painel_react.vbs
```

O painel abre em `http://127.0.0.1:8765`. Tambem e possivel usar
`run_react_panel.bat`. O build React pronto para uso fica em
`web_dashboard/dist`.

Aplicacao desktop de teste para validar um fluxo local de criacao de contas com Selenium, Firefox, SQLite, logs e exportacao.

Este projeto usa um alvo local em `127.0.0.1`, sem verificacao de e-mail. Ele nao automatiza sites de terceiros.

## O que faz

- Importa uma lista de proxies, um por linha.
- Cria uma fila com limite maximo de 10 contas por lote.
- Gera e-mails aleatorios com extensao `@gmail.com`.
- Usa a senha padrao `Rocha145`, editavel no painel.
- Abre o Firefox com um perfil isolado por conta.
- Pode carregar uma extensao Firefox `.xpi` em cada perfil automatizado.
- Pode copiar um perfil base do Firefox para cada perfil novo.
- Mostra no painel o caminho do perfil criado e o status da proxy no Firefox.
- Verifica o IP visto pelo navegador antes de preencher o cadastro.
- Executa com atraso configuravel entre etapas para acompanhar visualmente o processo.
- Preenche um formulario local de cadastro sem verificacao.
- Salva contas, status e logs em SQLite.
- Permite limpar somente os logs, mantendo contas e historico.
- Exporta historico para CSV.
- Continua para a proxima conta quando uma criacao falha.

## Requisitos

- Python 3.11 ou superior.
- Firefox instalado.
- Selenium. O Selenium Manager normalmente resolve o Geckodriver automaticamente.

Instalacao:

```powershell
cd C:\Users\doxyh\Downloads\iamjoaozin-main\account_test_manager
py -m venv .venv
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

## Como rodar

```powershell
py run_app.py
```

No painel:

1. Clique em `Importar proxies` se quiser associar proxies ao lote.
2. Se o cliente exigir uma extensao, clique em `Selecionar extensao XPI`.
3. Se quiser reaproveitar extensoes/configuracoes, clique em `Selecionar perfil base`.
4. Deixe `Quantidade` em ate `10`.
5. Confirme a senha padrao `Rocha145`.
6. Ajuste `Atraso (s)` se quiser acompanhar mais devagar.
7. Mantenha `Verificar IP do navegador antes do cadastro` ligado.
8. Clique em `Iniciar`.
9. Acompanhe `Proxy Firefox`, `IP navegador`, `Status IP`, `Perfil criado` e os logs.
10. Use `Limpar logs` quando quiser apagar apenas os logs.
11. Use `Exportar CSV` para salvar o historico.

## Extensao Firefox / Multi-Account Containers

O Selenium nao se conecta ao Firefox pessoal ja aberto do cliente. O fluxo controlado inicia perfis Firefox isolados e, opcionalmente, carrega um arquivo `.xpi` em cada perfil.

Para isolamento de sessao, o app ja cria um perfil Firefox separado por conta. Isso e mais previsivel em automacao do que tentar controlar a interface do Multi-Account Containers. Se voce tiver o `.xpi` da extensao, selecione no painel para validar que ela carrega junto com cada perfil do teste local.

Tambem e possivel selecionar uma pasta de perfil base. O app copia esse perfil para cada conta antes de abrir o Firefox. Feche o Firefox normal antes de copiar um perfil que esteja em uso.

## Proxies com usuario e senha

O painel registra uma proxy por conta e mostra esse vinculo no historico. Proxies sem autenticacao podem ser aplicadas direto nas preferencias do Firefox quando `Configurar proxy no Firefox quando possivel` esta ligado.

Proxies com usuario/senha precisam de uma extensao ou perfil Firefox ja preparado para responder ao prompt de autenticacao. Nesses casos, o painel mostra `proxy com usuario/senha associada; autenticacao exige extensao ou perfil preparado`, para ficar claro que a proxy foi associada na fila, mas nao autenticada automaticamente pelo Firefox.

Para conferir se a proxy entrou no navegador, observe as colunas `IP navegador` e `Status IP`. Elas mostram o IP visto pelo Firefox em uma pagina externa de checagem antes do cadastro local ser preenchido.

## Formatos de proxy aceitos para cadastro no painel

```text
host:porta
host:porta:usuario:senha
usuario:senha@host:porta
http://usuario:senha@host:porta
```

Observacao: no teste local, os proxies sao armazenados e associados uma conta por proxy. O alvo e `127.0.0.1`, entao o navegador preserva acesso local para que o formulario funcione.

## Gerar executavel

```powershell
cd C:\Users\doxyh\Downloads\iamjoaozin-main\account_test_manager
.\.venv\Scripts\Activate.ps1
py -m pip install pyinstaller
py -m PyInstaller --noconsole --onefile --name AccountTestManager run_app.py
```

O executavel ficara em:

```text
account_test_manager\dist\AccountTestManager.exe
```

## PoC visual: containers com proxy por cenario de rede

O arquivo `mac_proxy_ui_poc.py` e uma prova de conceito separada para laboratorio:
ele usa `pyautogui` e `opencv-python` para clicar na interface do Firefox
Multi-Account Containers e configurar um proxy por container.

Se preferir um painel com botoes de iniciar, pausar, continuar e parar, use
`mac_proxy_ui_panel.py` ou de duplo clique em `run_mac_proxy_panel.bat`.

Fluxo recomendado:

1. Instale as dependencias:

```powershell
cd C:\Users\doxyh\Downloads\iamjoaozin-main\account_test_manager
.\.venv\Scripts\Activate.ps1
py -m pip install -r requirements.txt
```

2. Copie o exemplo:

```powershell
Copy-Item .\network_scenarios.example.json .\network_scenarios.json
```

3. Edite `network_scenarios.json` com seus cenarios de laboratorio.
4. Capture os PNGs descritos em `mac_ui_templates\README.md`.
5. Feche o Firefox, mantenha a escala do Windows em 100% e rode:

```powershell
py mac_proxy_ui_poc.py --config network_scenarios.json
```

Para testar o reconhecimento sem clicar:

```powershell
py mac_proxy_ui_poc.py --config network_scenarios.json --dry-run
```

Para abrir o painel:

```powershell
py mac_proxy_ui_panel.py
```

No painel:

1. Cole ou carregue a lista JSON de cenarios.
2. Confirme o caminho do `firefox.exe`.
3. Selecione um perfil Firefox de laboratorio, se necessario.
4. Confirme a pasta `mac_ui_templates`.
5. Clique em `Validar`.
6. Clique em `Iniciar`.
7. Use `Pausar`, `Continuar` e `Parar` quando precisar.

O painel tambem aceita lista crua de proxies, uma por linha:

```text
92.112.170.122:6091:usuario:senha
85.198.47.196:6464:usuario:senha
```

Para esse formato, escolha `Lista crua usa http`, `https` ou `socks5`.
Na maioria dos provedores que anunciam `HTTP/HTTPS`, use `http`; isso ainda
permite acessar sites HTTPS via CONNECT.

Apos a execucao, abra cada container manualmente e valide a rota em
`https://ipinfo.io`.
