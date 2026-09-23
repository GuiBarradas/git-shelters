import type { Metadata } from "next";

import { LegalPage, pickLang } from "../LegalPage";

export const metadata: Metadata = { title: "Terms · Git Shelters" };

type Props = { searchParams: Promise<{ lang?: string }> };

/** Short, honest terms for a free public alpha, in English and Portuguese. */
export default async function TermsPage({ searchParams }: Props) {
  const lang = pickLang((await searchParams).lang);
  const updated = "2026-09-23";

  if (lang === "pt") {
    return (
      <LegalPage title="Termos" updated={updated} lang="pt" path="/legal/terms">
        <h2>O combinado</h2>
        <p>
          Git Shelters é um jogo gratuito em alpha pública, mantido por uma pessoa. Você pode
          jogar, compartilhar o seu perfil público e parar quando quiser. Não há pagamento,
          assinatura nem nada à venda.
        </p>

        <h2>A sua conta</h2>
        <p>
          Uma conta por login do GitHub, e você precisa ter idade para ter uma conta lá, pelos
          termos do GitHub. Bytes vêm da sua própria atividade pública no GitHub. Fabricar
          atividade para farmar bytes (pushes de bot, repositórios descartáveis, histórico
          reescrito) vai contra o espírito do jogo; os filtros anti-cheese podem descartar isso e
          o mantenedor pode zerar um saldo claramente farmado.
        </p>

        <h2>Alpha é alpha</h2>
        <p>
          Saldos, salas e eventos podem ser rebalanceados, migrados ou zerados entre versões.
          Avisaremos no changelog quando acontecer. O jogo é fornecido como está, sem garantia, e
          pode ficar indisponível a qualquer momento.
        </p>

        <h2>Conteúdo</h2>
        <p>
          O código é aberto sob a licença AGPL-3.0, no repositório público. O nome do jogo, o
          cenário, os personagens, os textos e a identidade visual não fazem parte dessa licença
          e ficam com o mantenedor. Os seus dados do GitHub continuam seus; veja o{" "}
          <a href="/legal/privacy?lang=pt">aviso de privacidade</a> para saber o que lemos e como
          apagar.
        </p>

        <h2>Música</h2>
        <p>
          O tema é &ldquo;Uncontained&rdquo;, de Alana Jordan. As faixas de ambiente são &ldquo;The
          Shining Ambience&rdquo;, de Mezhdunami, e &ldquo;The Foyer Mirror&rdquo;, de turning_pages.
          As três são usadas sob a Pixabay Content License. O som fica desligado até você ligar, e
          a escolha fica no seu navegador.
        </p>

        <h2>Mudanças</h2>
        <p>
          Estes termos podem mudar conforme o jogo cresce. A data acima é a última revisão;
          continuar jogando depois de uma mudança significa que você a aceita.
        </p>

        <h2>Contato</h2>
        <p>
          Guilherme Martins Barradas ·{" "}
          <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>
        </p>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Terms" updated={updated} lang="en" path="/legal/terms">
      <h2>The deal</h2>
      <p>
        Git Shelters is a free game in public alpha, run by one maintainer. You may play it,
        share your public profile and stop whenever you like. There is no payment, no
        subscription and nothing to buy.
      </p>

      <h2>Your account</h2>
      <p>
        One account per GitHub login, and you must be old enough to hold one under
        GitHub&apos;s terms. Bytes are earned from your own public GitHub activity.
        Fabricating activity to farm bytes (bot pushes, throwaway repositories, rewritten
        history) is against the spirit of the game; the anti-cheese filters may discard it and
        the maintainer may reset a balance that was clearly farmed.
      </p>

      <h2>Alpha means alpha</h2>
      <p>
        Balances, rooms and events may be rebalanced, migrated or reset between releases. We
        will say so in the changelog when it happens. The game is provided as is, without
        warranty, and may be unavailable at any time.
      </p>

      <h2>Content</h2>
      <p>
        The code is open source under the AGPL-3.0 license, in the public repository. The
        game&apos;s name, setting, characters, texts and visual identity are not part of that
        license and stay with the maintainer. Your GitHub data stays yours; see the{" "}
        <a href="/legal/privacy">privacy notice</a> for what we read and how to delete it.
      </p>

      <h2>Music</h2>
      <p>
        The theme is &ldquo;Uncontained&rdquo; by Alana Jordan. The ambience tracks are &ldquo;The
        Shining Ambience&rdquo; by Mezhdunami and &ldquo;The Foyer Mirror&rdquo; by turning_pages. All
        three are used under the Pixabay Content License. Sound is off until you turn it on, and the
        choice stays in your browser.
      </p>

      <h2>Changes</h2>
      <p>
        These terms may change as the game grows. The date above is the last revision;
        continuing to play after a change means you accept it.
      </p>

      <h2>Contact</h2>
      <p>
        Guilherme Martins Barradas ·{" "}
        <a href="mailto:guilhermebarradasdev@gmail.com">guilhermebarradasdev@gmail.com</a>
      </p>
    </LegalPage>
  );
}
