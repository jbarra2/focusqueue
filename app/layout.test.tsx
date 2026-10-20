import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ErrorPage from "./error";
import RootLayout from "./layout";

describe("RootLayout", () => {
  it("puts whatever a page renders in the full-height column, once", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <header>Top</header>
        <main>Body</main>
      </RootLayout>,
    );
    expect(html).toContain('<body><div class="page"><header>Top</header><main>Body</main></div>');
    expect(html.split('class="page"')).toHaveLength(2);
  });

  it("sets the language and the theme", () => {
    const html = renderToStaticMarkup(<RootLayout>x</RootLayout>);
    expect(html).toContain('lang="en"');
    expect(html).toContain('data-theme="warm"');
  });
});

describe("the error page", () => {
  it("is a main of its own, and takes its frame from the layout", () => {
    const html = renderToStaticMarkup(<ErrorPage retry={() => {}} />);
    expect(html.startsWith("<main>")).toBe(true);
    expect(html.endsWith("</main>")).toBe(true);
    expect(html).not.toContain('class="page"');
  });

  it("says one sentence that does not give the error away, and offers to try again", () => {
    const html = renderToStaticMarkup(<ErrorPage retry={() => {}} />);
    expect(html).toContain(
      '<p role="alert">The task list could not be loaded. Try again, or restart the app.</p>',
    );
    expect(html).toContain("Try again</button>");
  });
});
