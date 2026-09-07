import { mediaquery, window } from '@kit.ArkUI';
import { preferences } from '@kit.ArkData';
import { Calculator } from '../utils/CalculatorUtils';
import { HistoryEntry, addHistory } from '../utils/HistoryUtils';
import { OceanTheme } from '../utils/ThemeUtils';
import { keyHaptic } from '../utils/HapticUtils';
import { GraphCalc } from '../components/GraphCalc';
import { HistoryView } from '../components/HistoryView';
import { SettingsView } from '../components/SettingsView';

@Entry
@Component
struct Index {
  @State tab: string = 'BASIC';
  @State activePanel: string = '';
  @State @Watch('syncSystemBars') appearance: string = 'System';
  @State @Watch('syncSystemBars') systemDark: boolean = false;
  @State haptic: boolean = false;
  @State angle: string = 'DEG';
  @State @Watch('refreshAnswer') answerFormat: string = 'Auto';
  @State @Watch('refreshAnswer') precision: number = 10;
  @State launchPage: string = 'Basic';
  @State secondary: boolean = false;
  @State result: string = '0';
  @State expression: string = '';
  @State history: HistoryEntry[] = [];
  @State viewportHeight: number = 760;
  private basic: Calculator = new Calculator();
  private scientific: Calculator = new Calculator();
  private scroller: Scroller = new Scroller();
  private settingsStore: preferences.Preferences | null = null;
  private nextHistoryId: number = 1;
  private colorQuery: mediaquery.MediaQueryListener = this.getUIContext().getMediaQuery().matchMediaSync('(dark-mode: true)');
  private colorChanged = (value: mediaquery.MediaQueryResult): void => { this.systemDark = value.matches; };
  private basicKeys: string[] = ['÷', '×', '⌫', 'AC', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '.', '0', '%'];
  private scienceKeys: string[] = ['sin', 'cos', 'tan', 'π', '√', 'x²', 'xʸ', '(', 'ln', 'log', 'e', ')',
    '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];
  private alternateKeys: string[] = ['asin', 'acos', 'atan', 'eˣ', 'sinh', 'cosh', 'tanh', 'DMS', 'nCr', 'nPr', 'GCD', 'LCM',
    '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '=', '+'];

  aboutToAppear(): void {
    this.loadSettings();
    this.tab = this.launchPage.toUpperCase();
    this.refreshAnswer();
    this.systemDark = this.colorQuery.matches;
    this.colorQuery.on('change', this.colorChanged);
    this.syncSystemBars();
  }

  aboutToDisappear(): void { this.colorQuery.off('change', this.colorChanged); }

  onBackPress(): boolean {
    if (this.activePanel !== '') { this.showPanel(''); return true; }
    if (this.tab !== 'BASIC') { this.switchTab('BASIC'); return true; }
    return false;
  }

  private isDark(): boolean { return this.appearance === 'Dark' || (this.appearance === 'System' && this.systemDark); }
  private theme(): OceanTheme { return new OceanTheme(this.isDark()); }
  private syncSystemBars(): void {
    const theme = this.theme();
    window.getLastWindow(this.getUIContext().getHostContext()!).then((appWindow: window.Window) => {
      return appWindow.setWindowSystemBarProperties({
        statusBarColor: theme.background, navigationBarColor: theme.background,
        statusBarContentColor: theme.ink, navigationBarContentColor: theme.ink
      });
    }).catch(() => {});
  }
  private model(): Calculator { return this.tab === 'SCIENTIFIC' ? this.scientific : this.basic; }

  private refreshAnswer(): void {
    this.result = this.model().answer(this.answerFormat, this.precision);
    this.expression = this.model().expression;
  }

  private loadSettings(): void {
    try {
      this.settingsStore = preferences.getPreferencesSync(this.getUIContext().getHostContext()!, { name: 'OceanCalcSettings' });
      const mode = this.settingsStore.getSync('appearance', 'System') as string;
      const angle = this.settingsStore.getSync('angle', 'DEG') as string;
      const format = this.settingsStore.getSync('format', 'Auto') as string;
      const precision = this.settingsStore.getSync('precision', 10) as number;
      const launch = this.settingsStore.getSync('launch', 'Basic') as string;
      this.appearance = ['System', 'Light', 'Dark'].includes(mode) ? mode : 'System';
      this.angle = angle === 'RAD' ? 'RAD' : 'DEG';
      this.answerFormat = ['Auto', 'Decimal', 'Scientific'].includes(format) ? format : 'Auto';
      this.precision = [2, 4, 6, 10].includes(precision) ? precision : 10;
      this.launchPage = ['Basic', 'Scientific', 'Graph'].includes(launch) ? launch : 'Basic';
      this.haptic = this.settingsStore.getSync('haptic', false) === true;
    } catch (_) {
      this.getUIContext().getPromptAction().showToast({ message: '无法读取设置' });
    }
  }

  private saveSettings(): void {
    try {
      if (!this.settingsStore) { throw new Error('Preferences unavailable'); }
      this.settingsStore.putSync('appearance', this.appearance);
      this.settingsStore.putSync('angle', this.angle);
      this.settingsStore.putSync('format', this.answerFormat);
      this.settingsStore.putSync('precision', this.precision);
      this.settingsStore.putSync('launch', this.launchPage);
      this.settingsStore.putSync('haptic', this.haptic);
      this.settingsStore.flushSync();
      this.refreshAnswer();
    } catch (_) {
      this.getUIContext().getPromptAction().showToast({ message: '无法保存设置' });
    }
  }

  private recall(entry: HistoryEntry): void {
    this.switchTab(entry.module);
    if (entry.module === 'SCIENTIFIC') { this.angle = entry.angle; this.saveSettings(); }
    this.model().restore(entry.state);
    this.refreshAnswer();
  }

  private showPanel(panel: string): void {
    const hasScroller = this.activePanel !== 'History';
    this.activePanel = panel;
    if (hasScroller) { this.scroller.scrollTo({ xOffset: 0, yOffset: 0 }); }
  }

  private switchTab(tab: string): void {
    this.tab = tab;
    this.showPanel('');
    this.refreshAnswer();
  }

  private press(key: string): void {
    keyHaptic(this.haptic);
    const model = this.model();
    model.press(key, this.angle);
    this.refreshAnswer();
    if (model.record !== '' && model.recordState !== null) {
      this.history = addHistory(this.history, { id: this.nextHistoryId++, module: this.tab,
        formula: model.recordFormula, answer: this.result, angle: this.angle, state: model.recordState });
    }
  }

  @Builder
  calcKey(label: string) {
    Button(label === 'AC' ? '清空' : label, { type: ButtonType.Normal }).id('key-' + label)
      .width('100%').height('100%').borderRadius(18)
      .fontSize(this.tab === 'SCIENTIFIC' ? 21 : 26).fontWeight(FontWeight.Medium)
      .fontColor(label === '=' ? this.theme().white : this.theme().ink)
      .backgroundColor(label === '=' ? this.theme().accent :
        (/^[0-9.]$/.test(label) ? this.theme().key : this.theme().operator))
      .shadow({ radius: 3, color: '#0C102838', offsetY: 2 })
      .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.95 })
      .accessibilityText(label === '⌫' ? '退格' : label === 'AC' ? '清空' : label)
      .onClick(() => { this.press(label); })
  }

  @Builder
  calculator() {
    Column() {
      Column({ space: 6 }) {
        if (this.tab === 'SCIENTIFIC') {
          Row() {
            Button('更多').id('science-secondary').height(32).fontSize(14)
              .backgroundColor(this.secondary ? this.theme().accent : this.theme().operator)
              .fontColor(this.secondary ? this.theme().white : this.theme().ink)
              .onClick(() => { this.secondary = !this.secondary; })
            Button(this.angle).id('science-angle').height(32).fontSize(14).margin({ left: 6 })
              .backgroundColor(this.theme().operator).fontColor(this.theme().ink)
              .onClick(() => { this.angle = this.angle === 'DEG' ? 'RAD' : 'DEG'; this.saveSettings(); })
            Blank()
            Button('清空').id('science-clear').height(32).fontSize(13)
              .backgroundColor(this.theme().operator).fontColor(this.theme().ink)
              .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.95 })
              .onClick(() => { this.press('AC'); })
            Button('⌫').id('science-backspace').height(32).fontSize(15).margin({ left: 6 })
              .backgroundColor(this.theme().operator).fontColor(this.theme().ink)
              .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.95 })
              .onClick(() => { this.press('⌫'); })
          }.width('100%')
        } else {
          Row() {
            Button('mod').id('key-mod').height(32).fontSize(16)
              .backgroundColor(this.theme().operator).fontColor(this.theme().ink)
              .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.95 })
              .onClick(() => { this.press('mod'); })
            Blank()
          }.width('100%')
        }
        Blank()
        Text(this.expression || ' ').id('expression').width('100%').textAlign(TextAlign.End)
          .fontSize(19).fontColor(this.theme().muted).maxLines(2).textOverflow({ overflow: TextOverflow.Ellipsis })
        Text(this.result === 'Error' ? '错误' : this.result).id('result').width('100%').textAlign(TextAlign.End)
          .fontSize(this.tab === 'BASIC' ? 60 : 44).minFontSize(25)
          .maxFontSize(this.tab === 'BASIC' ? 60 : 44).maxLines(1).fontWeight(FontWeight.Medium)
          .fontColor(this.theme().ink)
      }.height(this.tab === 'BASIC' ? Math.max(215, (this.viewportHeight - 120) * 0.41) : 190)
        .width('100%').padding({ left: 24, right: 24, top: 16, bottom: 24 })
      Grid() {
        ForEach(this.tab === 'BASIC' ? this.basicKeys : (this.secondary ? this.alternateKeys : this.scienceKeys), (label: string, index: number) => {
          GridItem() { this.calcKey(label) }
            .rowStart(Math.floor(index / 4))
            .rowEnd(this.tab === 'BASIC' && label === '=' ? 4 : Math.floor(index / 4))
            .columnStart(index % 4).columnEnd(index % 4)
        }, (label: string) => this.tab + label)
      }.columnsTemplate('1fr 1fr 1fr 1fr')
        .rowsTemplate(this.tab === 'BASIC' ? '1fr 1fr 1fr 1fr 1fr' : '1fr 1fr 1fr 1fr 1fr 1fr 1fr')
        .rowsGap(10).columnsGap(10)
        .height(this.tab === 'BASIC' ? Math.max(340, (this.viewportHeight - 120) * 0.59) : Math.max(364, this.viewportHeight - 310))
        .padding(18).backgroundColor(this.theme().panel).borderRadius(28).width('100%')
    }.width('100%')
  }

  build() {
    Column() {
      Row({ space: 8 }) {
        Text('计算器').fontSize(25).fontWeight(FontWeight.Bold).fontColor(this.theme().ink)
        Blank()
        if (this.activePanel === '') {
          Button('历史').id('open-history').fontSize(12).height(36)
            .backgroundColor(this.theme().panel).fontColor(this.theme().ink).onClick(() => { this.showPanel('History'); })
          Button('设置').id('open-settings').fontSize(12).height(36)
            .backgroundColor(this.theme().panel).fontColor(this.theme().ink).onClick(() => { this.showPanel('Settings'); })
        } else {
          Button('返回').id('close-overlay').height(36).fontSize(14)
            .backgroundColor(this.theme().panel).fontColor(this.theme().ink).onClick(() => { this.showPanel(''); })
        }
      }.width('100%').padding({ left: 20, right: 20, top: 14, bottom: 12 })
      if (this.activePanel === '') {
        Row({ space: 4 }) {
          ForEach(['BASIC', 'SCIENTIFIC', 'GRAPH'], (name: string) => {
            Button(name === 'BASIC' ? '基础计算' : name === 'SCIENTIFIC' ? '科学计算' : '函数图像').id('tab-' + name).layoutWeight(1).height(38).fontSize(12)
              .fontWeight(FontWeight.Bold)
              .backgroundColor(this.tab === name ? this.theme().accent : this.theme().background)
              .fontColor(this.tab === name ? this.theme().white : this.theme().muted)
              .onClick(() => { this.switchTab(name); })
          })
        }.width('100%').padding({ left: 18, right: 18, bottom: 8 })
      }
      if (this.activePanel === 'History') {
        HistoryView({ items: $history, dark: this.isDark(), onRecall: (entry: HistoryEntry) => { this.recall(entry); } })
          .layoutWeight(1)
      } else {
        Scroll(this.scroller) {
          Column() {
            if (this.activePanel === 'Settings') {
              SettingsView({ appearance: $appearance, angle: $angle, answerFormat: $answerFormat,
                precision: $precision, haptic: $haptic, launchPage: $launchPage, dark: this.isDark(),
                onSave: () => { this.saveSettings(); } })
            }
            else if (this.tab === 'GRAPH') { GraphCalc({ dark: this.isDark() }) }
            else { this.calculator() }
          }.width('100%').constraintSize({ maxWidth: 600 })
        }.layoutWeight(1).width('100%').align(Alignment.Top).scrollBar(BarState.Off)
          .onAppear(() => { this.scroller.scrollTo({ xOffset: 0, yOffset: 0 }); })
      }
    }.width('100%').height('100%').backgroundColor(this.theme().background)
      .onAreaChange((oldArea: Area, newArea: Area) => { this.viewportHeight = Number(newArea.height); })
  }
}
