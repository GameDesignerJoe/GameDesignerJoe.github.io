// Colour sets. Every procedural sprite pulls from here, so a re-skin is a data
// edit. `base` is the main fill, `mid` the curl shadow, `shade` the rim and
// `light` the highlight.

export const WOOL = {
  cream:    { base: '#fbf3df', mid: '#efe2c3', shade: '#d9c7a2', light: '#ffffff' },
  charcoal: { base: '#4a5372', mid: '#3d4561', shade: '#2f3650', light: '#6c789b' },
  cocoa:    { base: '#a77a52', mid: '#946945', shade: '#7a5436', light: '#c69a70' },
  ash:      { base: '#c9ccd3', mid: '#b5b9c3', shade: '#9a9fac', light: '#eceef2' },
  rose:     { base: '#f6b9cf', mid: '#eca3bd', shade: '#d986a5', light: '#ffe2ec' },
  butter:   { base: '#f7dc8a', mid: '#ecca6b', shade: '#d4ab4c', light: '#fff2c4' },
  sky:      { base: '#a9d4f2', mid: '#92c2e6', shade: '#73a6cf', light: '#e1f2ff' },
  mint:     { base: '#b6e6c6', mid: '#9dd6b1', shade: '#7cbd93', light: '#e3fbe9' },
  lilac:    { base: '#cdb8ec', mid: '#b9a1e0', shade: '#9a80c9', light: '#ece2ff' },
};

export const FACE = {
  cream: { base: '#f3e6cc', shade: '#d8c39f', light: '#fffaf0', muzzle: '#f1cfc0', inner: '#f0a9a4' },
  tan:   { base: '#d9b48c', shade: '#b8906a', light: '#f0d4b4', muzzle: '#e8b9a3', inner: '#e8968f' },
  dark:  { base: '#3f4459', shade: '#2c3042', light: '#5d6481', muzzle: '#575d76', inner: '#c98a92' },
};

export const HORN = { base: '#5c6a8c', shade: '#3f4b69', light: '#8494b8' };
export const HOOF = { base: '#5a4636', shade: '#3e2f24', light: '#7b6350' };

// The wolf under the wool — slate blue-grey like the reference wolf.
export const WOLF = {
  grey:  { base: '#7a8aa6', mid: '#6a7994', shade: '#55627c', light: '#a4b2c9', pale: '#dfe5ee', dark: '#3a4358' },
  black: { base: '#3f4760', mid: '#363d53', shade: '#2a3043', light: '#5d6886', pale: '#8e98b0', dark: '#1d2130' },
  white: { base: '#e9eef6', mid: '#d6deea', shade: '#b7c3d6', light: '#ffffff', pale: '#ffffff', dark: '#7a8aa6' },
};

export const EYE = {
  white: '#ffffff',
  pupil: '#1d2030',
  wolf: '#f2c230',
  wolfRim: '#c58a12',
};
