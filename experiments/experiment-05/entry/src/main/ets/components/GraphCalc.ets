import { GraphExpression, sampleGraph } from '../utils/GraphExpression';
import { OceanTheme } from '../utils/ThemeUtils';

@Component
export struct GraphCalc {
  @Prop @Watch('draw') dark: boolean = false;
  @State selected: string = 'sin(x)';
  @State input: string = 'sin(x)';
  @State error: boolean = false;
  private expression: GraphExpression = new GraphExpression('sin(x)');
  private inputController: TextInputController = new TextInputController();
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true));
  private ready: boolean = false;
  private functions: string[] = ['sin(x)', 'cos(x)', 'tan(x)', 'x²', 'x³', '√x'];

  private plot(shortcut: string = ''): void {
    this.inputController.stopEditing();
    if (shortcut.length > 0) {
      this.input = shortcut === 'x²' ? 'x^2' : shortcut === 'x³' ? 'x^3' :
        shortcut === '√x' ? 'sqrt(x)' : shortcut;
    }
    this.expression = new GraphExpression(this.input);
    this.error = !this.expression.evaluate(0).valid;
    this.selected = this.error ? '' : (shortcut.length > 0 ? shortcut : this.input.trim());
    this.draw();
  }

  private draw(): void {
    if (!this.ready) { return; }
    const ctx = this.context;
    const w = ctx.width;
    const h = ctx.height;
    if (w <= 0 || h <= 0) { return; }
    const theme = new OceanTheme(this.dark);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = theme.key;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let n = -10; n <= 10; n += 2) {
      const px = (n + 10) * w / 20;
      const py = (10 - n) * h / 20;
      ctx.moveTo(px, 0); ctx.lineTo(px, h);
      ctx.moveTo(0, py); ctx.lineTo(w, py);
    }
    ctx.stroke();
    ctx.strokeStyle = theme.muted;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.fillStyle = theme.muted;
    ctx.font = `${this.getUIContext().vp2px(11)}px sans-serif`;
    ctx.fillText('−10', 5, h / 2 + 16);
    ctx.fillText('10', w - 20, h / 2 + 16);
    ctx.fillText('0', w / 2 + 5, h / 2 + 16);
    ctx.fillText('y', w / 2 + 7, 15);
    ctx.fillText('x', w - 12, h / 2 - 8);
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (!this.error) {
      const points = sampleGraph(this.expression);
      for (const point of points) {
        if (!Number.isFinite(point.y)) { continue; }
        const px = (point.x + 10) * w / 20;
        const py = (10 - point.y) * h / 20;
        if (point.connect) { ctx.lineTo(px, py); }
        else { ctx.moveTo(px, py); }
      }
    }
    ctx.stroke();
  }

  build() {
    Column({ space: 16 }) {
      Row() {
        Text('函数图像').fontSize(24).fontWeight(FontWeight.Bold)
          .fontColor(new OceanTheme(this.dark).ink)
      }.width('100%')
      Grid() {
        ForEach(this.functions, (fn: string) => {
          GridItem() {
            Button(fn).id('graph-' + fn).width('100%').height(42).fontSize(16)
              .backgroundColor(this.selected === fn ? new OceanTheme(this.dark).accent : new OceanTheme(this.dark).key)
              .fontColor(this.selected === fn ? new OceanTheme(this.dark).white : new OceanTheme(this.dark).ink)
              .clickEffect({ level: ClickEffectLevel.LIGHT, scale: 0.95 })
              .onClick(() => { this.plot(fn); })
          }
        })
      }.columnsTemplate('1fr 1fr 1fr').rowsTemplate('1fr 1fr').columnsGap(8).rowsGap(8).height(92)
      Row({ space: 8 }) {
        TextInput({ text: this.input, placeholder: '输入函数表达式', controller: this.inputController }).id('graph-input')
          .layoutWeight(1).height(46).maxLength(256).fontSize(17)
          .cancelButton({ style: CancelButtonStyle.CONSTANT })
          .fontColor(new OceanTheme(this.dark).ink)
          .backgroundColor(new OceanTheme(this.dark).key)
          .enterKeyType(EnterKeyType.Done)
          .onChange((value: string) => { this.input = value; })
          .onSubmit(() => { this.plot(); })
        Button('绘图').id('graph-plot').height(46)
          .backgroundColor(new OceanTheme(this.dark).accent)
          .fontColor(new OceanTheme(this.dark).white)
          .onClick(() => { this.plot(); })
      }.width('100%')
      if (this.error) {
        Text('表达式无效').id('graph-error').fontSize(16)
          .fontColor(new OceanTheme(this.dark).danger).width('100%')
      } else {
        Text('y = ' + this.selected).id('graph-expression').fontSize(20).fontWeight(FontWeight.Medium)
          .fontColor(new OceanTheme(this.dark).accent).width('100%')
      }
      Canvas(this.context).id('graph-canvas').width('100%').height(330).borderRadius(20).clip(true)
        .onReady(() => { this.ready = true; this.draw(); })
        .onAreaChange(() => { this.draw(); })
    }.width('100%').padding(20)
  }
}
