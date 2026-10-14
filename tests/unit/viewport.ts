/** jsdom has no matchMedia: answer min-/max-width queries for a fixed viewport width. */
export function setViewportWidth(width: number) {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    const max = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: (!min || width >= Number(min[1])) && (!max || width <= Number(max[1])),
      addEventListener() {},
      removeEventListener() {},
    };
  }) as unknown as typeof window.matchMedia;
}
