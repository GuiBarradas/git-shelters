import type { Metadata } from "next";

import { LegalPage, pickLang } from "../LegalPage";

export const metadata: Metadata = { title: "Privacy · Git Shelters" };

type Props = { searchParams: Promise<{ lang?: string }> };

/**
 * Plain-language privacy notice, in English and Portuguese. Every claim
 * here is checked against the code: if a new data source lands, this page
 * changes in the same PR. The controller is named as the LGPD asks.
 */
export default async function PrivacyPage({ searchParams }: Props) {
  const lang = pickLang((await searchParams).lang);
  const updated = "2026-09-23";

  if (lang === "pt") {
    return (
      <LegalPage title="Privacidade" updated={updated} lang="pt" path="/legal/privacy">
        <h2>Quem responde pelos dados</h2>
        <p>
          Guilherme Martins Barradas, pessoa física, mantenedor do Git Shelters. Contato para
          qualquer pedido sobre os seus dados:{" "}
          <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>.
        </p>

        <h2>O que coletamos</h2>
        <p>
          Ao conectar o GitHub, recebemos o seu login, o seu id numérico e o e-mail que o GitHub
          compartilha no login. Depois lemos o seu feed <em>público</em> de eventos do GitHub
          para contar pushes. Nunca lemos conteúdo de repositório, repositórios privados nem nada
          que exija mais do que o feed público.
        </p>
        <p>
          Jogar cria dados de jogo: um livro-razão de bytes, as salas que você constrói, os seus
          Forks, os Daily Events que você resolve, os badges que ganha, um cursor de sincronização,
          quando você foi visto pela última vez e se a intro já tocou. Também registramos, no nosso
          próprio servidor, uma lista curta de eventos de produto (cadastro, início e fim de
          sessão, sala construída, evento resolvido, badge ganho), ligados ao seu id de usuário,
          para saber se o jogo funciona. Erros vão para o Sentry com um rastro técnico e o seu id,
          nunca o seu e-mail.
        </p>

        <h2>Por quê</h2>
        <p>
          Para rodar o jogo. A sua atividade no GitHub é a única entrada do jogo. Não vendemos,
          compartilhamos nem usamos nada disso para publicidade.
        </p>

        <h2>Onde ficam</h2>
        <p>
          Supabase (banco de dados e login) e Vercel (hospedagem), ambos em contas do mantenedor.
          O Sentry recebe relatórios de erro. Nenhum outro terceiro recebe os seus dados.
        </p>

        <h2>O que é público</h2>
        <p>
          A sua página de perfil público mostra o seu login do GitHub, o seu saldo de bytes,
          quando você entrou, as salas do seu bunker e os badges que ganhou. O mapa-múndi mostra
          os mesmos fatos como um ponto na sua região. Nada além disso fica visível para outros
          jogadores.
        </p>

        <h2>Cookies</h2>
        <p>
          Só o cookie de sessão que mantém você logado. Não há cookie de analytics, pixel de
          rastreamento nem script de terceiros. O seu navegador guarda uma preferência nossa, se o
          som está ligado, no armazenamento local; ela nunca sai do seu aparelho.
        </p>

        <h2>Os seus direitos (LGPD, GDPR)</h2>
        <p>
          Em <a href="/settings">Configurações</a> você baixa tudo o que temos sobre você em JSON,
          incluindo os eventos de produto, ou apaga a sua conta. A exclusão é imediata e
          permanente: remove o seu login, o seu livro-razão, o seu bunker, os seus badges, o seu
          histórico de eventos e os seus eventos de produto. Guardamos uma linha de auditoria (um
          id interno e um horário) como prova de que a exclusão aconteceu.
        </p>
        <p>
          Revogar o Git Shelters nas configurações do GitHub interrompe qualquer leitura futura do
          seu feed público. Isso não apaga os dados de jogo; use o botão de apagar para isso.
        </p>
        <p>
          Confirmação de tratamento, acesso, correção, portabilidade, anonimização e eliminação:
          escreva para o e-mail acima. Respondemos em até 15 dias.
        </p>

        <h2>Contato</h2>
        <p>
          Guilherme Martins Barradas ·{" "}
          <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>. Bugs
          e pedidos também podem virar issue no repositório público.
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Privacy" updated={updated} lang="en" path="/legal/privacy">
      <h2>Who is responsible</h2>
      <p>
        Guilherme Martins Barradas, an individual, the maintainer of Git Shelters. Contact for
        anything about your data:{" "}
        <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>.
      </p>

      <h2>What we collect</h2>
      <p>
        When you connect GitHub, we receive your GitHub login, numeric user id and the email
        address GitHub shares with the sign-in. We then read your <em>public</em> GitHub events
        feed to count pushes. We never read repository contents, private repositories or
        anything that needs more than the public feed.
      </p>
      <p>
        Playing creates game data: a byte ledger, the rooms you build, your Forks, the Daily
        Events you resolve, the badges you earn, a sync cursor, when you were last seen and
        whether the intro has played. We also log a short list of product events on our own
        server (sign-up, session start and end, a room built, an event resolved, a badge
        earned), tied to your user id, to see whether the game works. Errors are reported to
        Sentry with a technical trace and your user id, never your email.
      </p>

      <h2>Why</h2>
      <p>
        To run the game. Your GitHub activity is the game&apos;s only input. We do not sell,
        share or use any of it for advertising.
      </p>

      <h2>Where it lives</h2>
      <p>
        Supabase (database and sign-in) and Vercel (hosting), both under the maintainer&apos;s
        accounts. Sentry receives error reports. No other third party receives your data.
      </p>

      <h2>What is public</h2>
      <p>
        Your public profile page shows your GitHub login, your byte balance, when you joined,
        the rooms in your bunker and the badges you earned. The world map shows the same facts
        as a dot in your region. Nothing else is visible to other players.
      </p>

      <h2>Cookies</h2>
      <p>
        Only the session cookie that keeps you signed in. There is no analytics cookie, no
        tracking pixel and no third-party script. Your browser also keeps one preference for
        us, whether sound is on, in its local storage; it never leaves your device.
      </p>

      <h2>Your rights (LGPD, GDPR)</h2>
      <p>
        From <a href="/settings">Settings</a> you can download everything we hold about you as
        JSON, including the product events, or delete your account. Deletion is immediate
        and permanent: it removes your sign-in, your ledger, your bunker, your badges, your
        event history and your product events. We keep a one-line audit entry (an internal id
        and a timestamp) as proof the deletion happened.
      </p>
      <p>
        Revoking Git Shelters in your GitHub settings stops any future reads of your public
        feed. It does not delete game data; use the delete button for that.
      </p>
      <p>
        Confirmation, access, correction, portability, anonymisation and erasure: write to the
        address above. We answer within 15 days.
      </p>

      <h2>Contact</h2>
      <p>
        Guilherme Martins Barradas ·{" "}
        <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>. Bugs
        and requests are also welcome as issues on the public repository.
      </p>
    </LegalPage>
  );
}
