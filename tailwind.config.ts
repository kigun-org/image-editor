import type {Config} from 'tailwindcss';
import daisyui from "daisyui";
import { scopedPreflightStyles, isolateInsideOfContainer } from 'tailwindcss-scoped-preflight'

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],

  theme: {
    extend: {}
  },

  plugins: [
    scopedPreflightStyles({
      isolationStrategy: isolateInsideOfContainer('.image-editor'), // style root name, used to wrap Popper menus etc
    }),
    daisyui
  ],

  daisyui: {
    themes: false,
    themeRoot: ".image-editor"
  },

  important: '.image-editor',

  prefix: "k-"
} satisfies Config;