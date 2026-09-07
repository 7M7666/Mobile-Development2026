import { OceanTheme } from '../utils/ThemeUtils';

const settingLabels: Record<string, string> = {
  'Appearance': '外观', 'Angle Unit': '角度单位', 'Answer Format': '答案格式',
  'Decimal Precision': '小数精度', 'Launch Page': '启动页面',
  'Light': '浅色', 'Dark': '深色', 'System': '跟随系统',
  'Auto': '自动', 'Decimal': '小数',
  'Basic': '基础计算', 'Scientific': '科学计算', 'Graph': '函数图像'
};

@Component
struct SettingChoice {
  @Prop title: string = '';
  @Prop options: string[] = [];
  @Prop selected: string = '';
  @Prop dark: boolean = false;
  onPick: (value: string) => void = () => {};

  build() {
    Column({ space: 14 }) {
      Text(settingLabels[this.title] ?? this.title).fontSize(18).fontWeight(FontWeight.Medium)
        .fontColor(new OceanTheme(this.dark).ink).width('100%')
      Row({ space: 6 }) {
        ForEach(this.options, (option: string) => {
          Button(this.title === 'Answer Format' && option === 'Scientific' ? '科学计数法' :
            this.title === 'Decimal Precision' ? option + ' 位' : (settingLabels[option] ?? option)).id(this.title + '-' + option)
            .layoutWeight(1).height(44).fontSize(13).padding({ left: 6, right: 6 })
            .backgroundColor(this.selected === option ? new OceanTheme(this.dark).accent : new OceanTheme(this.dark).panel)
            .fontColor(this.selected === option ? Color.White : new OceanTheme(this.dark).ink)
            .onClick(() => { this.onPick(option); })
        })
      }.width('100%')
    }.padding(18).backgroundColor(new OceanTheme(this.dark).key).borderRadius(22).width('100%')
  }
}

@Component
export struct SettingsView {
  @Link appearance: string;
  @Link angle: string;
  @Link answerFormat: string;
  @Link precision: number;
  @Link haptic: boolean;
  @Link launchPage: string;
  @Prop dark: boolean = false;
  onSave: () => void = () => {};

  build() {
    Column({ space: 18 }) {
      Text('设置').fontSize(30).fontWeight(FontWeight.Bold).fontColor(new OceanTheme(this.dark).ink).width('100%')
      SettingChoice({ title: 'Appearance', options: ['Light', 'Dark', 'System'], selected: this.appearance, dark: this.dark,
        onPick: (value: string) => { this.appearance = value; this.onSave(); } })
      SettingChoice({ title: 'Angle Unit', options: ['DEG', 'RAD'], selected: this.angle, dark: this.dark,
        onPick: (value: string) => { this.angle = value; this.onSave(); } })
      SettingChoice({ title: 'Answer Format', options: ['Auto', 'Decimal', 'Scientific'], selected: this.answerFormat, dark: this.dark,
        onPick: (value: string) => { this.answerFormat = value; this.onSave(); } })
      SettingChoice({ title: 'Decimal Precision', options: ['2', '4', '6', '10'], selected: this.precision.toString(), dark: this.dark,
        onPick: (value: string) => { this.precision = Number(value); this.onSave(); } })
      Row() {
        Text('触感反馈').fontSize(18).fontWeight(FontWeight.Medium).fontColor(new OceanTheme(this.dark).ink)
        Blank()
        Toggle({ type: ToggleType.Switch, isOn: this.haptic }).id('haptic-toggle')
          .accessibilityText('触感反馈').selectedColor(new OceanTheme(this.dark).accent)
          .onChange((value: boolean) => { this.haptic = value; this.onSave(); })
      }.padding(18).backgroundColor(new OceanTheme(this.dark).key).borderRadius(22).width('100%')
      SettingChoice({ title: 'Launch Page', options: ['Basic', 'Scientific', 'Graph'], selected: this.launchPage, dark: this.dark,
        onPick: (value: string) => { this.launchPage = value; this.onSave(); } })
    }.padding(20).width('100%')
  }
}
