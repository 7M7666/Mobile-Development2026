export class OceanTheme {
  background: string;
  panel: string;
  key: string;
  ink: string;
  muted: string;
  accent: string;
  operator: string;
  grid: string;
  danger: string = '#C83F4E';
  white: string = '#FFFFFF';
  constructor(dark: boolean) {
    this.background = dark ? '#101820' : '#F3F7FA';
    this.panel = dark ? '#19232E' : '#E6EFF5';
    this.key = dark ? '#263340' : '#FFFFFF';
    this.ink = dark ? '#F1F6FA' : '#142C3E';
    this.muted = dark ? '#A1B6C7' : '#586F80';
    this.accent = dark ? '#318BD1' : '#0868AD';
    this.operator = dark ? '#223F57' : '#CAE3F5';
    this.grid = dark ? '#314454' : '#D6E2EB';
  }
}
