import { HistoryEntry, filterHistory } from '../utils/HistoryUtils';
import { OceanTheme } from '../utils/ThemeUtils';

@Component
export struct HistoryView {
  @Link items: HistoryEntry[];
  @Prop dark: boolean = false;
  @State query: string = '';
  @State filter: string = 'ALL';
  onRecall: (entry: HistoryEntry) => void = () => {};

  @Builder
  deleteAction(id: number) {
    Button('删除').id('delete-' + id).height('100%').width(86)
      .backgroundColor(new OceanTheme(this.dark).danger).fontColor(Color.White)
      .onClick(() => { this.items = this.items.filter((item: HistoryEntry) => item.id !== id); })
  }

  build() {
    Column({ space: 16 }) {
      Text('历史记录').fontSize(30).fontWeight(FontWeight.Bold)
        .fontColor(new OceanTheme(this.dark).ink).width('100%')
      TextInput({ text: this.query, placeholder: '搜索历史记录' }).id('history-search').height(48)
        .fontColor(new OceanTheme(this.dark).ink).placeholderColor(new OceanTheme(this.dark).muted)
        .backgroundColor(new OceanTheme(this.dark).key).borderRadius(16)
        .onChange((text: string) => { this.query = text; })
      Row({ space: 6 }) {
        ForEach(['ALL', 'BASIC', 'SCIENTIFIC'], (module: string) => {
          Button(module === 'ALL' ? '全部' : module === 'BASIC' ? '基础计算' : '科学计算').id('filter-' + module).layoutWeight(1).height(40).fontSize(12)
            .backgroundColor(this.filter === module ? new OceanTheme(this.dark).accent : new OceanTheme(this.dark).panel)
            .fontColor(this.filter === module ? Color.White : new OceanTheme(this.dark).ink)
            .onClick(() => { this.filter = module; })
        })
      }.width('100%')
      if (filterHistory(this.items, this.filter, this.query).length === 0) {
        Text(this.items.length === 0 ? '暂无历史记录' : '未找到匹配记录')
          .fontSize(18).fontColor(new OceanTheme(this.dark).muted).padding(24)
      }
      List({ space: 12 }) {
        ForEach(filterHistory(this.items, this.filter, this.query), (item: HistoryEntry) => {
          ListItem() {
            Column({ space: 8 }) {
              Text(item.formula).fontSize(19).fontColor(new OceanTheme(this.dark).ink).width('100%')
              Text('= ' + item.answer).fontSize(23).fontWeight(FontWeight.Medium)
                .fontColor(new OceanTheme(this.dark).accent).width('100%').textAlign(TextAlign.End)
            }.id('history-' + item.id).width('100%').padding(18)
              .backgroundColor(new OceanTheme(this.dark).key).borderRadius(18)
              .onClick(() => { this.onRecall(item); })
          }.swipeAction({ end: () => { this.deleteAction(item.id); } })
        }, (item: HistoryEntry) => item.id.toString())
      }.layoutWeight(1).width('100%').scrollBar(BarState.Off)
    }.width('100%').height('100%').padding(20).constraintSize({ maxWidth: 600 })
  }
}
