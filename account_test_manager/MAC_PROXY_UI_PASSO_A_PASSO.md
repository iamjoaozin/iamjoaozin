# MAC Proxy UI PoC - passo a passo sem erro

Este painel automatiza a interface do Firefox Multi-Account Containers usando
mouse, teclado e reconhecimento de imagem. Ele so funciona bem quando os
recortes PNG batem com a sua tela atual.

## 1. Campos do painel

### Firefox

Use o caminho do executavel:

```text
C:\Program Files\Mozilla Firefox\firefox.exe
```

Se esse caminho nao existir, tente:

```text
C:\Program Files (x86)\Mozilla Firefox\firefox.exe
```

### Perfil Firefox

Deixe vazio na maioria dos casos.

Esse campo NAO e para colocar `firefox.exe`. Ele so deve ser usado se voce
quiser apontar para uma pasta de perfil especifica.

Para achar uma pasta de perfil:

1. Abra o Firefox manualmente.
2. Digite `about:profiles` na barra de endereco.
3. Ache o perfil desejado.
4. Copie o caminho de `Root Directory` / `Diretorio raiz`.
5. Cole esse caminho no campo `Perfil Firefox`.

Se estiver em duvida, deixe vazio.

### Templates

Deixe como:

```text
C:\Users\doxyh\Downloads\iamjoaozin-main\account_test_manager\mac_ui_templates
```

Clique em `Abrir templates` para abrir essa pasta.

### Lista crua usa

Para proxies no formato:

```text
IP:PORTA:USUARIO:SENHA
```

use `http`.

Mesmo que o fornecedor diga `HTTP/HTTPS`, normalmente o correto aqui e `http`.
Isso ainda permite acessar sites HTTPS pelo tunel CONNECT da proxy.

Use `https` apenas se o fornecedor disser explicitamente que a conexao com o
servidor proxy e HTTPS/TLS.

Use `socks5` apenas para proxy SOCKS5.

## 2. Lista de proxies

Voce pode colar direto a lista crua na caixa grande:

```text
92.112.170.122:6091:mbexxqgm:2irda1zh6qqv
85.198.47.196:6464:mbexxqgm:2irda1zh6qqv
92.112.172.195:6467:mbexxqgm:2irda1zh6qqv
```

O painel converte cada linha automaticamente para:

```text
http://USUARIO:SENHA@IP:PORTA
```

Exemplo:

```text
92.112.170.122:6091:mbexxqgm:2irda1zh6qqv
```

vira:

```text
http://mbexxqgm:2irda1zh6qqv@92.112.170.122:6091
```

## 3. Templates obrigatorios

O erro `Templates obrigatorios ausentes` significa que a pasta
`mac_ui_templates` ainda nao tem os PNGs que o robo precisa.

Voce precisa salvar estes arquivos exatamente com estes nomes:

```text
extension_icon.png
manage_containers_button.png
new_container_button.png
container_ok_button.png
advanced_proxy_settings_button.png
advanced_proxy_input.png
apply_to_container_button.png
```

E tambem pelo menos um destes:

```text
container_row_menu_button.png
container_row_arrow.png
```

### Como criar os templates

Use a Ferramenta de Captura do Windows.

Regras importantes:

1. Use escala do Windows em 100%.
2. Deixe o Firefox maximizado.
3. Nao mude o tema do Firefox depois de capturar.
4. Recorte so o botao/icone/campo necessario.
5. Salve como PNG.
6. Use exatamente os nomes acima.

### O que recortar em cada arquivo

`extension_icon.png`

Recorte o icone da extensao Multi-Account Containers na barra superior do
Firefox.

`manage_containers_button.png`

Abra a extensao e recorte o botao `Manage Containers`.

`new_container_button.png`

Dentro de `Manage Containers`, recorte o botao `New Container`.

`container_ok_button.png`

Na tela de criacao/edicao de container, recorte o botao `OK`.

`container_row_menu_button.png`

Depois de criar ou listar containers, recorte o pequeno botao/icone do lado
direito da linha de um container. O script usa a ocorrencia mais baixa da lista,
que normalmente e o container recem-criado.

`advanced_proxy_settings_button.png`

Dentro da tela do container, recorte a linha/botao `Advanced proxy settings`.

`advanced_proxy_input.png`

Depois de entrar em `Advanced proxy settings`, recorte o campo onde a proxy e
digitada. Recorte a borda/parte esquerda do campo vazio.

`apply_to_container_button.png`

Na mesma tela, recorte o botao `Apply to Container`.

### Templates opcionais

Se a extensao pedir permissao de proxy, capture tambem:

```text
enable_proxy_permission_button.png
permission_allow_button.png
```

`enable_proxy_permission_button.png` e o botao `Enable` dentro da extensao.

`permission_allow_button.png` e o botao de aceitar/permitir permissao no popup
do Firefox.

## 4. Ordem certa para rodar

1. Abra o painel pelo arquivo `run_mac_proxy_panel.bat`.
2. Apague o exemplo da caixa grande.
3. Cole a lista crua de proxies.
4. Em `Lista crua usa`, deixe `http`.
5. Confira o campo `Firefox`.
6. Deixe `Perfil Firefox` vazio, a menos que saiba exatamente qual perfil usar.
7. Clique em `Abrir templates`.
8. Coloque todos os PNGs obrigatorios na pasta.
9. Clique em `Validar`.
10. Se aparecer erro de template, corrija os arquivos faltantes.
11. Feche janelas extras do Firefox.
12. Clique em `Iniciar`.
13. Nao mexa no mouse/teclado enquanto ele roda.
14. Use `Pausar`, `Continuar` ou `Parar` no painel quando precisar.

## 5. Se ele nao encontrar algum botao

Tente nesta ordem:

1. Confira se o PNG existe na pasta `mac_ui_templates`.
2. Confira se o nome esta identico, incluindo `.png`.
3. Recapture o template menor, pegando so o botao/icone.
4. Deixe o Firefox maximizado.
5. Confira se o Windows esta em escala 100%.
6. Abaixe `Confianca` de `0.86` para `0.80`.
7. Se ainda falhar, use `0.75`.

Valores muito baixos podem fazer o robo clicar no lugar errado, entao prefira
recapturar bons templates antes de baixar demais.

## 6. Validacao final

Depois que terminar:

1. Abra um container criado.
2. Acesse `https://ipinfo.io`.
3. Confira se o IP/rota bate com a proxy esperada.
4. Repita em alguns containers.

Se o IP nao mudar, geralmente faltou conceder a permissao opcional `proxy` na
extensao Multi-Account Containers.
