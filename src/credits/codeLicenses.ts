/** Every runtime dependency shipped with the app, with its license. */
export interface CodeLicense {
  name: string;
  license: string;
  url: string;
  note?: string;
}

export const CODE_LICENSES: CodeLicense[] = [
  { name: 'React', license: 'MIT', url: 'https://github.com/facebook/react' },
  { name: 'Tone.js', license: 'MIT', url: 'https://github.com/Tonejs/Tone.js' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'Immer', license: 'MIT', url: 'https://github.com/immerjs/immer' },
  { name: 'nanoid', license: 'MIT', url: 'https://github.com/ai/nanoid' },
  { name: 'dnd kit', license: 'MIT', url: 'https://github.com/clauderic/dnd-kit' },
  { name: 'idb', license: 'ISC', url: 'https://github.com/jakearchibald/idb' },
];
