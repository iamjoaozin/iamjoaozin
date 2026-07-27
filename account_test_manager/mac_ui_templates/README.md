# Templates visuais para mac_proxy_ui_poc.py

Coloque nesta pasta recortes PNG da sua propria tela. O script usa OpenCV
para localizar esses elementos por similaridade visual, entao idioma, tema,
zoom e escala do Windows precisam bater com os recortes.

## Configuracao recomendada

1. Windows com escala de tela em 100%.
2. Firefox maximizado.
3. Extensao Firefox Multi-Account Containers fixada na barra de ferramentas.
4. Mesmo tema do Firefox durante captura e execucao.
5. Recortes pequenos, contendo somente o elemento visual necessario.

## Arquivos obrigatorios

- `extension_icon.png`: icone da extensao na barra de ferramentas.
- `manage_containers_button.png`: botao `Manage Containers`.
- `new_container_button.png`: botao `New Container`.
- `container_ok_button.png`: botao `OK` da tela de criacao/edicao.
- `advanced_proxy_settings_button.png`: linha/botao `Advanced proxy settings`.
- `advanced_proxy_input.png`: campo de texto da proxy avancada.
- `apply_to_container_button.png`: botao `Apply to Container`.

## Um destes dois tambem e necessario

- `container_row_menu_button.png`: menu/icone a direita da linha de um container
  na tela `Manage Containers`.
- `container_row_arrow.png`: seta/linha clicavel de um container na lista.

O script usa a ocorrencia mais baixa desse template para abrir o container
recem-criado.

## Arquivos opcionais

- `enable_proxy_permission_button.png`: botao `Enable` exibido quando a
  permissao opcional de proxy ainda nao foi concedida.
- `permission_allow_button.png`: botao de aceitar permissao no popup do Firefox.
- `web_form_input.png`: borda esquerda de um campo do site de teste. Quando a
  URL opcional do painel estiver preenchida, o OpenCV localiza o primeiro campo
  e usa Tab para acessar email e senha, mesmo que estejam fora da tela. Depois
  de preencher a senha, o script envia o formulario com Enter.
- `web_consent_understood_button.png`: botao `Entendi, obrigado` da mensagem de
  consentimento do site de teste. A procura e opcional durante a execucao, mas o
  recorte evita clicar nos botoes vizinhos quando a mensagem aparecer.
- `web_form_error.png`: faixa vermelha `Erro` exibida quando o site recusa o
  formulario. Quando reconhecida, a ocorrencia e salva em
  `form_error_occurrences.csv`, a pagina e atualizada e os campos sao refeitos
  com usuario sem espacos, outro Gmail e outra senha.
- `web_form_error_text.png`: recorte curto do texto `Erro`, usado para confirmar
  que uma faixa vermelha e realmente a mensagem de falha antes de aguardar cinco
  segundos e pressionar F5.
- `web_form_nickname_error_text.png`: recorte de `O apelido`, usado para detectar
  o aviso de nome ja utilizado. A repeticao gera outro nome noruegues sem
  espacos e com seis numeros aleatorios, alem de novo Gmail e nova senha.
- `found_city_button.png`: texto `Fundar cidade` usado somente para confirmar a
  pagina seguinte depois do Enter automatico. O script aguarda essa marca por
  ate tres minutos antes de registrar falha.

## Dica pratica

Use a Ferramenta de Captura do Windows para recortar exatamente o botao ou
icone. Evite recortes grandes com texto variavel, porque eles quebram quando
a lista de containers muda.
