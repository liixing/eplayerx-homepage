/**
 * Client-side i18n for the public /blocks portal.
 *
 * Pages are CDN-cached by URL, so locale must be resolved in the browser
 * (localStorage + navigator.languages) — never via Accept-Language SSR.
 */

export type UiLocale = "zh-CN" | "zh-TW" | "en" | "ja" | "es" | "ar";

export const UI_STORAGE_KEY = "blocks_ui_lang";
export const CONTENT_STORAGE_KEY = "blocks_content_lang";

export const UI_LOCALES: { code: UiLocale; label: string }[] = [
	{ code: "zh-CN", label: "简体中文" },
	{ code: "zh-TW", label: "繁體中文" },
	{ code: "en", label: "English" },
	{ code: "ja", label: "日本語" },
	{ code: "es", label: "Español" },
	{ code: "ar", label: "العربية" },
];

const UI_SET = new Set<string>(UI_LOCALES.map((l) => l.code));

/** Content language (TMDB code) → nearest UI locale. */
export function contentLangToUiLocale(code: string): UiLocale | null {
	const c = code.toLowerCase();
	if (c.startsWith("zh-tw") || c.startsWith("zh-hk") || c === "zh-hant")
		return "zh-TW";
	if (c.startsWith("zh")) return "zh-CN";
	if (c.startsWith("ja")) return "ja";
	if (c.startsWith("es")) return "es";
	if (c.startsWith("ar")) return "ar";
	if (c.startsWith("en")) return "en";
	return null;
}

/** Map a BCP-47 tag to a TMDB content language code. */
export function browserToContentLanguage(tag: string): string | null {
	const t = tag.trim().replace(/_/g, "-");
	if (!t) return null;
	const low = t.toLowerCase();
	const [lang, region] = low.split("-");
	if (lang === "zh") {
		if (region === "tw" || region === "hant") return "zh-TW";
		if (region === "hk") return "zh-HK";
		return "zh-CN";
	}
	const map: Record<string, string> = {
		en: "en-US",
		ja: "ja-JP",
		ko: "ko-KR",
		es: "es-ES",
		fr: "fr-FR",
		de: "de-DE",
		nl: "nl-NL",
		it: "it-IT",
		ru: "ru-RU",
		pt: "pt-BR",
		th: "th-TH",
		vi: "vi-VN",
		id: "id-ID",
		hi: "hi-IN",
		tr: "tr-TR",
		ar: "ar-SA",
	};
	return map[lang] ?? null;
}

export function browserToUiLocale(tag: string): UiLocale | null {
	const content = browserToContentLanguage(tag);
	return content ? contentLangToUiLocale(content) : null;
}

export function isUiLocale(v: string | null | undefined): v is UiLocale {
	return !!v && UI_SET.has(v);
}

type Dict = Record<string, string>;

const zhCN: Dict = {
	"nav.explore": "社区库",
	"nav.submit": "+ 投稿",
	"nav.submit_short": "投稿",
	"nav.ui_lang": "界面语言",
	"explore.title": "社区 Blocks",
	"explore.sub":
		"官方默认板块与社区共建板块,挑你喜欢的加进客户端首页。",
	"explore.search_ph": "搜索标题 / 作者",
	"explore.all_langs": "全部语言",
	"explore.cat.all": "全部",
	"explore.cat.movie": "电影",
	"explore.cat.tv": "电视剧",
	"explore.cat.anime": "动漫",
	"explore.cat.collection": "合集",
	"explore.cat.homepage": "首页",
	"explore.make_group": "生成合集",
	"explore.make_home": "生成首页",
	"explore.cancel": "取消",
	"explore.done": "完成",
	"explore.pick_hint": "挑选区块 · 点击加入，可跨页翻页",
	"explore.pick_hint_n": "已选 {n} 个 · 翻页不丢 · 点完成进入编辑",
	"explore.step_pick": "1. 挑选",
	"explore.step_edit": "2. 编辑",
	"explore.step_preview": "3. 预览",
	"explore.selected": "已选",
	"explore.empty_cat": "这个分类还没有板块,去投稿一个吧。",
	"explore.empty_home":
		"还没有已发布的首页,选中几个区块点「生成首页」试试。",
	"explore.prev": "上一页",
	"explore.next": "下一页",
	"explore.page_n": "第 {n} 页",
	"explore.pager": "分页",
	"tag.collection": "合集",
	"tag.homepage": "首页",
	"block.meta_charts": "{n} 个榜单 · 安装 {installs}",
	"block.meta_items": "{n} 项 · 安装 {installs}",
	"block.meta_home": "{n} 个区块 · 安装 {installs}",
	"block.install": "安装",
	"sel.selected_n": "已选 {n}",
	"sel.selected_cross": "已选 {n}（可跨页）",
	"sel.publish_group": "发布合集",
	"group.title_ph": "合集标题,如 每日新番榜",
	"group.mode_custom": "自定义",
	"group.mode_weekday": "按星期",
	"group.style_label": "合集样式",
	"group.style_capsule": "胶囊",
	"group.style_rank": "排行",
	"group.style_banner": "横幅",
	"group.style_image": "图片",
	"group.style_landscape": "横图",
	"group.style_portrait": "竖图",
	"group.create": "创建并发布",
	"group.admin_hint":
		"管理员操作:合集直接发布上架社区库,以一行胶囊卡片展示在首页。",
	"pack.back_pick": "继续挑选",
	"pack.edit_title": "编辑首页",
	"pack.edit_sub": "⋮⋮ 拖动排序 · 下方可改样式",
	"pack.preview": "预览",
	"pack.preview_title": "首页预览",
	"pack.preview_sub": "与发布后详情页相同 · 确认后即可发布",
	"pack.label_title": "标题",
	"pack.title_ph": "如 周末片单",
	"pack.label_author": "作者",
	"pack.optional_ph": "可选",
	"pack.label_desc": "简介",
	"pack.preview_home": "预览首页",
	"pack.back_edit": "返回编辑",
	"pack.confirm": "确认发布",
	"pack.copy_link": "复制链接",
	"pack.view_home": "查看首页",
	"pack.publish_home": "发布首页",
	"style.thumb": "横图",
	"style.poster": "竖图",
	"style.hero": "大图",
	"style.show": "展示",
	"style.rank_num": "序号",
	"style.overview": "简介",
	"style.drag": "拖拽排序",
	"chip.other_page": " · 其他页",
	"wd.1": "周一",
	"wd.2": "周二",
	"wd.3": "周三",
	"wd.4": "周四",
	"wd.5": "周五",
	"wd.6": "周六",
	"wd.7": "周日",
	"msg.need_one_block": "请至少选一个区块",
	"msg.pick_blocks_first": "请先选择区块",
	"msg.need_group_title": "请填写合集标题",
	"msg.group_min2": "合集至少需要 2 个榜单",
	"msg.group_max7": "按星期模式最多 7 个榜单",
	"msg.need_labels": "请为每个榜单填写标签",
	"msg.publishing": "发布中…",
	"msg.publish_fail": "发布失败",
	"msg.network": "网络错误",
	"msg.group_published": "已发布 · {id}（刷新页面查看）",
	"msg.need_home_title": "请填写首页标题",
	"msg.loading_preview": "加载首页预览…",
	"msg.preview_fail": "预览加载失败",
	"msg.untitled_home": "未命名首页",
	"msg.home_meta_confirm": "{n} 个区块 · 确认无误后发布",
	"msg.home_published":
		"首页已发布,可在「首页」分类查看,或在 iPhone 上打开链接导入。",
	"msg.copied_import": "已复制导入链接",
	"msg.preview_unavailable": "预览暂不可用",
	"msg.preview_in_app": "此区块会在 App 内展示",
	"msg.collection_nested": "（合集不可嵌套,已忽略）",
	"group.label_ph": "标签",
	"hp.sub":
		"{n} 个区块 · 安装 {installs}。在 iPhone 上安装后会作为一个新首页出现在客户端。",
	"hp.install": "安装到 App",
	"hp.copy": "复制链接",
	"submit.title": "投稿一个 Block",
	"submit.sub":
		"填一个数据源和展示信息,提交后由管理员抓取审核,通过即进社区库。",
	"submit.token": "TMDB API Token（必填,投稿凭证,管理员抓取时使用）",
	"submit.token_ph": "以 eyJ 开头的 Read Access Token",
	"submit.token_hint_before": "提交时会校验有效性。没有的话去",
	"submit.token_hint_link": "TMDB 申请",
	"submit.token_hint_after": "。",
	"submit.category": "分类",
	"submit.name": "名称",
	"submit.name_ph": "如 高分悬疑剧精选",
	"submit.language": "语言（TMDB 返回标题/简介的语言）",
	"submit.source": "榜单地址 / 数据",
	"submit.source_ph":
		'填一个榜单接口地址,如 /tmdb/trending/movie 或完整 URL\n或直接粘贴 JSON 数据,如 [{"id":603,"title":"黑客帝国"}, ...]',
	"submit.source_hint":
		"只需给一个能拿到榜单的地址,或把整段 JSON 数据贴进来。抓取与整理由管理员处理。",
	"submit.preset": "展示样式",
	"submit.preset_thumb": "横图流",
	"submit.preset_poster": "竖图流",
	"submit.preset_hero": "大图流",
	"submit.ov_note":
		"简介仅在「缩略图流」下展示,海报流/大图流不显示简介。",
	"submit.show_rank": "显示排行序号",
	"submit.show_overview": "显示简介",
	"submit.author": "署名（可选）",
	"submit.author_ph": "昵称,可留空",
	"submit.btn": "提交审核",
	"submit.submitting": "提交中…",
	"submit.submitted": "已提交",
	"submit.ok": "已提交审核,通过后会出现在社区库,感谢投稿!",
	"submit.err_token": "请填写 TMDB Token",
	"submit.err_title": "请填写名称",
	"submit.err_source": "请填写榜单地址或粘贴数据",
	"submit.err_fail": "提交失败",
	"import.sub":
		"{n} 个区块 · 在 iPhone 上打开本页即可导入 EplayerX 并生成新首页。",
	"import.open": "在 App 中导入",
	"import.download": "下载 EplayerX",
};

const zhTW: Dict = {
	...zhCN,
	"nav.explore": "社區庫",
	"nav.submit": "+ 投稿",
	"nav.submit_short": "投稿",
	"nav.ui_lang": "介面語言",
	"explore.title": "社區 Blocks",
	"explore.sub":
		"官方預設板塊與社區共建板塊，挑你喜歡的加進客戶端首頁。",
	"explore.search_ph": "搜尋標題 / 作者",
	"explore.all_langs": "全部語言",
	"explore.cat.all": "全部",
	"explore.cat.movie": "電影",
	"explore.cat.tv": "電視劇",
	"explore.cat.anime": "動漫",
	"explore.cat.collection": "合集",
	"explore.cat.homepage": "首頁",
	"explore.make_group": "生成合集",
	"explore.make_home": "生成首頁",
	"explore.cancel": "取消",
	"explore.done": "完成",
	"explore.pick_hint": "挑選區塊 · 點擊加入，可跨頁翻頁",
	"explore.pick_hint_n": "已選 {n} 個 · 翻頁不丟 · 點完成進入編輯",
	"explore.step_pick": "1. 挑選",
	"explore.step_edit": "2. 編輯",
	"explore.step_preview": "3. 預覽",
	"explore.selected": "已選",
	"explore.empty_cat": "這個分類還沒有板塊，去投稿一個吧。",
	"explore.empty_home":
		"還沒有已發布的首頁，選中幾個區塊點「生成首頁」試試。",
	"explore.prev": "上一頁",
	"explore.next": "下一頁",
	"explore.page_n": "第 {n} 頁",
	"explore.pager": "分頁",
	"tag.collection": "合集",
	"tag.homepage": "首頁",
	"block.meta_charts": "{n} 個榜單 · 安裝 {installs}",
	"block.meta_items": "{n} 項 · 安裝 {installs}",
	"block.meta_home": "{n} 個區塊 · 安裝 {installs}",
	"block.install": "安裝",
	"sel.selected_n": "已選 {n}",
	"sel.selected_cross": "已選 {n}（可跨頁）",
	"sel.publish_group": "發布合集",
	"group.title_ph": "合集標題，如 每日新番榜",
	"group.mode_custom": "自訂",
	"group.mode_weekday": "按星期",
	"group.style_label": "合集樣式",
	"group.style_capsule": "膠囊",
	"group.style_rank": "排行",
	"group.style_banner": "橫幅",
	"group.style_image": "圖片",
	"group.style_landscape": "橫圖",
	"group.style_portrait": "豎圖",
	"group.create": "建立並發布",
	"group.admin_hint":
		"管理員操作：合集直接發布上架社區庫，以一行膠囊卡片展示在首頁。",
	"pack.back_pick": "繼續挑選",
	"pack.edit_title": "編輯首頁",
	"pack.edit_sub": "⋮⋮ 拖動排序 · 下方可改樣式",
	"pack.preview": "預覽",
	"pack.preview_title": "首頁預覽",
	"pack.preview_sub": "與發布後詳情頁相同 · 確認後即可發布",
	"pack.label_title": "標題",
	"pack.title_ph": "如 週末片單",
	"pack.label_author": "作者",
	"pack.optional_ph": "可選",
	"pack.label_desc": "簡介",
	"pack.preview_home": "預覽首頁",
	"pack.back_edit": "返回編輯",
	"pack.confirm": "確認發布",
	"pack.copy_link": "複製連結",
	"pack.view_home": "查看首頁",
	"pack.publish_home": "發布首頁",
	"style.thumb": "橫圖",
	"style.poster": "豎圖",
	"style.hero": "大圖",
	"style.show": "展示",
	"style.rank_num": "序號",
	"style.overview": "簡介",
	"style.drag": "拖曳排序",
	"chip.other_page": " · 其他頁",
	"wd.1": "週一",
	"wd.2": "週二",
	"wd.3": "週三",
	"wd.4": "週四",
	"wd.5": "週五",
	"wd.6": "週六",
	"wd.7": "週日",
	"msg.need_one_block": "請至少選一個區塊",
	"msg.pick_blocks_first": "請先選擇區塊",
	"msg.need_group_title": "請填寫合集標題",
	"msg.group_min2": "合集至少需要 2 個榜單",
	"msg.group_max7": "按星期模式最多 7 個榜單",
	"msg.need_labels": "請為每個榜單填寫標籤",
	"msg.publishing": "發布中…",
	"msg.publish_fail": "發布失敗",
	"msg.network": "網路錯誤",
	"msg.group_published": "已發布 · {id}（重新整理頁面查看）",
	"msg.need_home_title": "請填寫首頁標題",
	"msg.loading_preview": "載入首頁預覽…",
	"msg.preview_fail": "預覽載入失敗",
	"msg.untitled_home": "未命名首頁",
	"msg.home_meta_confirm": "{n} 個區塊 · 確認無誤後發布",
	"msg.home_published":
		"首頁已發布，可在「首頁」分類查看，或在 iPhone 上打開連結匯入。",
	"msg.copied_import": "已複製匯入連結",
	"hp.sub":
		"{n} 個區塊 · 安裝 {installs}。在 iPhone 上安裝後會作為一個新首頁出現在客戶端。",
	"hp.install": "安裝到 App",
	"hp.copy": "複製連結",
	"submit.title": "投稿一個 Block",
	"submit.sub":
		"填一個資料來源和展示資訊，提交後由管理員抓取審核，通過即進社區庫。",
	"submit.token": "TMDB API Token（必填，投稿憑證，管理員抓取時使用）",
	"submit.token_ph": "以 eyJ 開頭的 Read Access Token",
	"submit.token_hint_before": "提交時會校驗有效性。沒有的話去",
	"submit.token_hint_link": "TMDB 申請",
	"submit.token_hint_after": "。",
	"submit.category": "分類",
	"submit.name": "名稱",
	"submit.name_ph": "如 高分懸疑劇精選",
	"submit.language": "語言（TMDB 回傳標題/簡介的語言）",
	"submit.source": "榜單地址 / 資料",
	"submit.source_ph":
		'填一個榜單介面地址，如 /tmdb/trending/movie 或完整 URL\n或直接貼上 JSON 資料，如 [{"id":603,"title":"駭客任務"}, ...]',
	"submit.source_hint":
		"只需給一個能拿到榜單的地址，或把整段 JSON 資料貼進來。抓取與整理由管理員處理。",
	"submit.preset": "展示樣式",
	"submit.preset_thumb": "橫圖流",
	"submit.preset_poster": "豎圖流",
	"submit.preset_hero": "大圖流",
	"submit.ov_note":
		"簡介僅在「縮圖流」下展示，海報流/大圖流不顯示簡介。",
	"submit.show_rank": "顯示排行序號",
	"submit.show_overview": "顯示簡介",
	"submit.author": "署名（可選）",
	"submit.author_ph": "暱稱，可留空",
	"submit.btn": "提交審核",
	"submit.submitting": "提交中…",
	"submit.submitted": "已提交",
	"submit.ok": "已提交審核，通過後會出現在社區庫，感謝投稿！",
	"submit.err_token": "請填寫 TMDB Token",
	"submit.err_title": "請填寫名稱",
	"submit.err_source": "請填寫榜單地址或貼上資料",
	"submit.err_fail": "提交失敗",
	"import.sub":
		"{n} 個區塊 · 在 iPhone 上打開本頁即可匯入 EplayerX 並生成新首頁。",
	"import.open": "在 App 中匯入",
	"import.download": "下載 EplayerX",
};

const en: Dict = {
	"nav.explore": "Library",
	"nav.submit": "+ Submit",
	"nav.submit_short": "Submit",
	"nav.ui_lang": "Language",
	"explore.title": "Community Blocks",
	"explore.sub":
		"Official defaults and community charts — pick what you like for your home screen.",
	"explore.search_ph": "Search title / author",
	"explore.all_langs": "All languages",
	"explore.cat.all": "All",
	"explore.cat.movie": "Movies",
	"explore.cat.tv": "TV",
	"explore.cat.anime": "Anime",
	"explore.cat.collection": "Collections",
	"explore.cat.homepage": "Homepages",
	"explore.make_group": "Make collection",
	"explore.make_home": "Make homepage",
	"explore.cancel": "Cancel",
	"explore.done": "Done",
	"explore.pick_hint": "Pick blocks · tap to add, works across pages",
	"explore.pick_hint_n":
		"{n} selected · kept across pages · Done to edit",
	"explore.step_pick": "1. Pick",
	"explore.step_edit": "2. Edit",
	"explore.step_preview": "3. Preview",
	"explore.selected": "Selected",
	"explore.empty_cat": "Nothing here yet — submit a block?",
	"explore.empty_home":
		"No published homepages yet. Select blocks and tap “Make homepage”.",
	"explore.prev": "Previous",
	"explore.next": "Next",
	"explore.page_n": "Page {n}",
	"explore.pager": "Pagination",
	"tag.collection": "Collection",
	"tag.homepage": "Homepage",
	"block.meta_charts": "{n} lists · {installs} installs",
	"block.meta_items": "{n} items · {installs} installs",
	"block.meta_home": "{n} blocks · {installs} installs",
	"block.install": "Install",
	"sel.selected_n": "{n} selected",
	"sel.selected_cross": "{n} selected (cross-page)",
	"sel.publish_group": "Publish collection",
	"group.title_ph": "Collection title, e.g. Daily anime",
	"group.mode_custom": "Custom",
	"group.mode_weekday": "By weekday",
	"group.style_label": "Collection style",
	"group.style_capsule": "Capsule",
	"group.style_rank": "Rank",
	"group.style_banner": "Banner",
	"group.style_image": "Image",
	"group.style_landscape": "Landscape",
	"group.style_portrait": "Portrait",
	"group.create": "Create & publish",
	"group.admin_hint":
		"Admin: publish a collection to the library as a row of capsule cards.",
	"pack.back_pick": "Keep picking",
	"pack.edit_title": "Edit homepage",
	"pack.edit_sub": "⋮⋮ Drag to reorder · change styles below",
	"pack.preview": "Preview",
	"pack.preview_title": "Homepage preview",
	"pack.preview_sub": "Same as the public detail page · publish when ready",
	"pack.label_title": "Title",
	"pack.title_ph": "e.g. Weekend picks",
	"pack.label_author": "Author",
	"pack.optional_ph": "Optional",
	"pack.label_desc": "Description",
	"pack.preview_home": "Preview homepage",
	"pack.back_edit": "Back to edit",
	"pack.confirm": "Publish",
	"pack.copy_link": "Copy link",
	"pack.view_home": "View homepage",
	"pack.publish_home": "Publish homepage",
	"style.thumb": "Thumb",
	"style.poster": "Poster",
	"style.hero": "Hero",
	"style.show": "Display",
	"style.rank_num": "Rank",
	"style.overview": "Overview",
	"style.drag": "Drag to reorder",
	"chip.other_page": " · other page",
	"wd.1": "Mon",
	"wd.2": "Tue",
	"wd.3": "Wed",
	"wd.4": "Thu",
	"wd.5": "Fri",
	"wd.6": "Sat",
	"wd.7": "Sun",
	"msg.need_one_block": "Select at least one block",
	"msg.pick_blocks_first": "Select blocks first",
	"msg.need_group_title": "Enter a collection title",
	"msg.group_min2": "A collection needs at least 2 lists",
	"msg.group_max7": "Weekday mode allows at most 7 lists",
	"msg.need_labels": "Label every list",
	"msg.publishing": "Publishing…",
	"msg.publish_fail": "Publish failed",
	"msg.network": "Network error",
	"msg.group_published": "Published · {id} (refresh to see it)",
	"msg.need_home_title": "Enter a homepage title",
	"msg.loading_preview": "Loading homepage preview…",
	"msg.preview_fail": "Preview failed to load",
	"msg.untitled_home": "Untitled homepage",
	"msg.home_meta_confirm": "{n} blocks · publish when ready",
	"msg.home_published":
		"Homepage published. Find it under Homepages, or open the link on iPhone to import.",
	"msg.copied_import": "Import link copied",
	"msg.preview_unavailable": "Preview unavailable",
	"msg.preview_in_app": "This block is shown inside the App",
	"msg.collection_nested": " (collections can't nest — skipped)",
	"group.label_ph": "Label",
	"hp.sub":
		"{n} blocks · {installs} installs. On iPhone, install to add it as a new home screen.",
	"hp.install": "Install in App",
	"hp.copy": "Copy link",
	"submit.title": "Submit a Block",
	"submit.sub":
		"Add a data source and display options. Admins fetch and review before it joins the library.",
	"submit.token": "TMDB API Token (required — used when admins scrape)",
	"submit.token_ph": "Read Access Token starting with eyJ",
	"submit.token_hint_before": "Validated on submit. Get one from",
	"submit.token_hint_link": "TMDB",
	"submit.token_hint_after": ".",
	"submit.category": "Category",
	"submit.name": "Title",
	"submit.name_ph": "e.g. Top mystery dramas",
	"submit.language": "Language (TMDB titles & overviews)",
	"submit.source": "List URL / data",
	"submit.source_ph":
		'A list API URL, e.g. /tmdb/trending/movie or a full URL\nor paste JSON, e.g. [{"id":603,"title":"The Matrix"}, ...]',
	"submit.source_hint":
		"Provide a list endpoint or paste JSON. Admins handle fetching and cleanup.",
	"submit.preset": "Layout",
	"submit.preset_thumb": "Thumbnails",
	"submit.preset_poster": "Posters",
	"submit.preset_hero": "Hero",
	"submit.ov_note":
		"Overviews only show in thumbnail layout, not poster/hero.",
	"submit.show_rank": "Show rank numbers",
	"submit.show_overview": "Show overview",
	"submit.author": "Credit (optional)",
	"submit.author_ph": "Nickname, optional",
	"submit.btn": "Submit for review",
	"submit.submitting": "Submitting…",
	"submit.submitted": "Submitted",
	"submit.ok": "Submitted! It will appear in the library after approval.",
	"submit.err_token": "Enter a TMDB token",
	"submit.err_title": "Enter a title",
	"submit.err_source": "Enter a list URL or paste data",
	"submit.err_fail": "Submit failed",
	"import.sub":
		"{n} blocks · Open on iPhone to import into EplayerX as a new homepage.",
	"import.open": "Open in App",
	"import.download": "Get EplayerX",
};

const ja: Dict = {
	...en,
	"nav.explore": "コミュニティ",
	"nav.submit": "+ 投稿",
	"nav.submit_short": "投稿",
	"nav.ui_lang": "表示言語",
	"explore.title": "コミュニティ Blocks",
	"explore.sub":
		"公式とコミュニティのチャートから、ホームに追加したいものを選べます。",
	"explore.search_ph": "タイトル / 作者で検索",
	"explore.all_langs": "すべての言語",
	"explore.cat.all": "すべて",
	"explore.cat.movie": "映画",
	"explore.cat.tv": "ドラマ",
	"explore.cat.anime": "アニメ",
	"explore.cat.collection": "コレクション",
	"explore.cat.homepage": "ホーム",
	"explore.make_group": "コレクション作成",
	"explore.make_home": "ホーム作成",
	"explore.cancel": "キャンセル",
	"explore.done": "完了",
	"explore.pick_hint": "ブロックを選ぶ · タップで追加、ページをまたげます",
	"explore.pick_hint_n": "{n} 件選択 · ページ移動でも保持 · 完了で編集",
	"explore.step_pick": "1. 選択",
	"explore.step_edit": "2. 編集",
	"explore.step_preview": "3. プレビュー",
	"explore.selected": "選択中",
	"explore.empty_cat": "この分類にはまだありません。投稿してみてください。",
	"explore.empty_home":
		"公開ホームはまだありません。ブロックを選んで「ホーム作成」を押してください。",
	"explore.prev": "前へ",
	"explore.next": "次へ",
	"explore.page_n": "{n} ページ",
	"tag.collection": "コレクション",
	"tag.homepage": "ホーム",
	"block.meta_charts": "{n} リスト · インストール {installs}",
	"block.meta_items": "{n} 件 · インストール {installs}",
	"block.meta_home": "{n} ブロック · インストール {installs}",
	"block.install": "インストール",
	"sel.selected_n": "{n} 件選択",
	"sel.publish_group": "コレクションを公開",
	"group.create": "作成して公開",
	"pack.edit_title": "ホームを編集",
	"pack.preview_title": "ホームプレビュー",
	"pack.confirm": "公開する",
	"pack.copy_link": "リンクをコピー",
	"pack.publish_home": "ホームを公開",
	"msg.network": "ネットワークエラー",
	"msg.copied_import": "インポートリンクをコピーしました",
	"hp.install": "App にインストール",
	"hp.copy": "リンクをコピー",
	"submit.title": "Block を投稿",
	"submit.btn": "審査に提出",
	"submit.ok": "提出しました。承認後にライブラリに表示されます。",
	"import.open": "App で取り込む",
	"import.download": "EplayerX を入手",
};

const es: Dict = {
	...en,
	"nav.explore": "Biblioteca",
	"nav.submit": "+ Enviar",
	"nav.submit_short": "Enviar",
	"nav.ui_lang": "Idioma",
	"explore.title": "Blocks de la comunidad",
	"explore.sub":
		"Listas oficiales y de la comunidad: elige las que quieras en tu inicio.",
	"explore.search_ph": "Buscar título / autor",
	"explore.all_langs": "Todos los idiomas",
	"explore.cat.all": "Todo",
	"explore.cat.movie": "Películas",
	"explore.cat.tv": "Series",
	"explore.cat.anime": "Anime",
	"explore.cat.collection": "Colecciones",
	"explore.cat.homepage": "Inicios",
	"explore.make_group": "Crear colección",
	"explore.make_home": "Crear inicio",
	"explore.cancel": "Cancelar",
	"explore.done": "Listo",
	"explore.prev": "Anterior",
	"explore.next": "Siguiente",
	"explore.page_n": "Página {n}",
	"tag.collection": "Colección",
	"tag.homepage": "Inicio",
	"block.install": "Instalar",
	"pack.confirm": "Publicar",
	"pack.copy_link": "Copiar enlace",
	"msg.network": "Error de red",
	"msg.copied_import": "Enlace de importación copiado",
	"hp.install": "Instalar en la app",
	"hp.copy": "Copiar enlace",
	"submit.title": "Enviar un Block",
	"submit.btn": "Enviar a revisión",
	"submit.ok": "¡Enviado! Aparecerá en la biblioteca tras la aprobación.",
	"import.open": "Abrir en la app",
	"import.download": "Descargar EplayerX",
};

const ar: Dict = {
	...en,
	"nav.explore": "المكتبة",
	"nav.submit": "+ إرسال",
	"nav.submit_short": "إرسال",
	"nav.ui_lang": "لغة الواجهة",
	"explore.title": "قوائم المجتمع",
	"explore.sub":
		"قوائم رسمية ومجتمعية — اختر ما يعجبك لشاشة البداية.",
	"explore.search_ph": "بحث بالعنوان / الكاتب",
	"explore.all_langs": "كل اللغات",
	"explore.cat.all": "الكل",
	"explore.cat.movie": "أفلام",
	"explore.cat.tv": "مسلسلات",
	"explore.cat.anime": "أنمي",
	"explore.cat.collection": "مجموعات",
	"explore.cat.homepage": "صفحات رئيسية",
	"explore.make_group": "إنشاء مجموعة",
	"explore.make_home": "إنشاء صفحة رئيسية",
	"explore.cancel": "إلغاء",
	"explore.done": "تم",
	"explore.pick_hint": "اختر القوائم · اضغط للإضافة عبر الصفحات",
	"explore.pick_hint_n":
		"تم اختيار {n} · يُحفظ عبر الصفحات · تم للتحرير",
	"explore.step_pick": "1. اختيار",
	"explore.step_edit": "2. تحرير",
	"explore.step_preview": "3. معاينة",
	"explore.selected": "المحدد",
	"explore.empty_cat": "لا يوجد شيء هنا بعد — أرسل قائمة؟",
	"explore.empty_home":
		"لا صفحات منشورة بعد. اختر قوائم واضغط «إنشاء صفحة رئيسية».",
	"explore.prev": "السابق",
	"explore.next": "التالي",
	"explore.page_n": "صفحة {n}",
	"tag.collection": "مجموعة",
	"tag.homepage": "صفحة رئيسية",
	"block.meta_charts": "{n} قوائم · {installs} تثبيت",
	"block.meta_items": "{n} عناصر · {installs} تثبيت",
	"block.meta_home": "{n} قوائم · {installs} تثبيت",
	"block.install": "تثبيت",
	"sel.selected_n": "تم اختيار {n}",
	"sel.publish_group": "نشر المجموعة",
	"group.mode_custom": "مخصص",
	"group.mode_weekday": "حسب اليوم",
	"group.create": "إنشاء ونشر",
	"pack.back_pick": "متابعة الاختيار",
	"pack.edit_title": "تحرير الصفحة",
	"pack.preview": "معاينة",
	"pack.preview_title": "معاينة الصفحة",
	"pack.label_title": "العنوان",
	"pack.label_author": "الكاتب",
	"pack.optional_ph": "اختياري",
	"pack.label_desc": "الوصف",
	"pack.back_edit": "رجوع للتحرير",
	"pack.confirm": "نشر",
	"pack.copy_link": "نسخ الرابط",
	"pack.view_home": "عرض الصفحة",
	"pack.publish_home": "نشر الصفحة",
	"msg.need_one_block": "اختر قائمة واحدة على الأقل",
	"msg.pick_blocks_first": "اختر القوائم أولاً",
	"msg.publishing": "جارٍ النشر…",
	"msg.publish_fail": "فشل النشر",
	"msg.network": "خطأ في الشبكة",
	"msg.need_home_title": "أدخل عنوان الصفحة",
	"msg.loading_preview": "جارٍ تحميل المعاينة…",
	"msg.preview_fail": "فشل تحميل المعاينة",
	"msg.untitled_home": "صفحة بلا عنوان",
	"msg.home_published":
		"تم النشر. تجدها تحت الصفحات الرئيسية، أو افتح الرابط على iPhone للاستيراد.",
	"msg.copied_import": "تم نسخ رابط الاستيراد",
	"hp.sub":
		"{n} قوائم · {installs} تثبيت. على iPhone ثبّتها كصفحة رئيسية جديدة.",
	"hp.install": "تثبيت في التطبيق",
	"hp.copy": "نسخ الرابط",
	"submit.title": "إرسال قائمة",
	"submit.sub":
		"أضف مصدر البيانات وخيارات العرض. يراجعها المشرف قبل إضافتها للمكتبة.",
	"submit.category": "التصنيف",
	"submit.name": "الاسم",
	"submit.language": "اللغة (عناوين وملخصات TMDB)",
	"submit.source": "رابط القائمة / البيانات",
	"submit.preset": "التخطيط",
	"submit.preset_thumb": "مصغّرات",
	"submit.preset_poster": "ملصقات",
	"submit.preset_hero": "كبير",
	"submit.show_rank": "إظهار الترتيب",
	"submit.show_overview": "إظهار الملخص",
	"submit.author": "التوقيع (اختياري)",
	"submit.btn": "إرسال للمراجعة",
	"submit.submitting": "جارٍ الإرسال…",
	"submit.submitted": "تم الإرسال",
	"submit.ok": "تم الإرسال! ستظهر في المكتبة بعد الموافقة.",
	"submit.err_token": "أدخل رمز TMDB",
	"submit.err_title": "أدخل اسماً",
	"submit.err_source": "أدخل رابطاً أو الصق بيانات",
	"submit.err_fail": "فشل الإرسال",
	"import.sub":
		"{n} قوائم · افتح على iPhone لاستيرادها إلى EplayerX كصفحة رئيسية.",
	"import.open": "فتح في التطبيق",
	"import.download": "تحميل EplayerX",
};

export const MESSAGES: Record<UiLocale, Dict> = {
	"zh-CN": zhCN,
	"zh-TW": zhTW,
	en,
	ja,
	es,
	ar,
};

export function t(
	locale: UiLocale,
	key: string,
	vars?: Record<string, string | number>,
): string {
	const primary = MESSAGES[locale]?.[key];
	const fallback = MESSAGES.en[key] ?? MESSAGES["zh-CN"][key] ?? key;
	let s = primary ?? fallback;
	if (vars) {
		for (const [k, v] of Object.entries(vars)) {
			s = s.split(`{${k}}`).join(String(v));
		}
	}
	return s;
}

/** Prefer saved UI locale, else first matching navigator language, else zh-CN. */
export function resolveUiLocale(
	saved: string | null,
	languages: readonly string[],
): UiLocale {
	if (isUiLocale(saved)) return saved;
	for (const tag of languages) {
		const ui = browserToUiLocale(tag);
		if (ui) return ui;
	}
	return "zh-CN";
}

/**
 * Preferred content language code from browser tags.
 * Caller should fall back to "" (all) if the code is not in the filter options.
 */
export function resolveContentLanguage(
	saved: string | null,
	languages: readonly string[],
): string | null {
	// Explicitly saved (including "" for all languages).
	if (saved !== null) return saved;
	for (const tag of languages) {
		const code = browserToContentLanguage(tag);
		if (code) return code;
	}
	return null;
}

/** Early <head> boot: set html lang/dir before paint; stash prefs on window. */
export function clientI18nBootScript(): string {
	return `(function(){
var UI_KEY=${JSON.stringify(UI_STORAGE_KEY)};
var CONTENT_KEY=${JSON.stringify(CONTENT_STORAGE_KEY)};
var MSGS=${JSON.stringify(MESSAGES)};
var UI_CODES=${JSON.stringify(UI_LOCALES.map((l) => l.code))};
function isUi(v){return UI_CODES.indexOf(v)>=0;}
function browserToContent(tag){
  if(!tag)return null;
  var t=String(tag).trim().replace(/_/g,'-');
  var low=t.toLowerCase();
  var parts=low.split('-');
  var lang=parts[0], region=parts[1];
  if(lang==='zh'){
    if(region==='tw'||region==='hant')return 'zh-TW';
    if(region==='hk')return 'zh-HK';
    return 'zh-CN';
  }
  var map={en:'en-US',ja:'ja-JP',ko:'ko-KR',es:'es-ES',fr:'fr-FR',de:'de-DE',nl:'nl-NL',it:'it-IT',ru:'ru-RU',pt:'pt-BR',th:'th-TH',vi:'vi-VN',id:'id-ID',hi:'hi-IN',tr:'tr-TR',ar:'ar-SA'};
  return map[lang]||null;
}
function contentToUi(code){
  if(!code)return null;
  var c=String(code).toLowerCase();
  if(c.indexOf('zh-tw')===0||c.indexOf('zh-hk')===0||c==='zh-hant')return 'zh-TW';
  if(c.indexOf('zh')===0)return 'zh-CN';
  if(c.indexOf('ja')===0)return 'ja';
  if(c.indexOf('es')===0)return 'es';
  if(c.indexOf('ar')===0)return 'ar';
  if(c.indexOf('en')===0)return 'en';
  return null;
}
function browserToUi(tag){return contentToUi(browserToContent(tag));}
var savedUi=null,savedContent=null;
try{savedUi=localStorage.getItem(UI_KEY);}catch(e){}
try{savedContent=localStorage.getItem(CONTENT_KEY);}catch(e){}
var nav=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||'zh-CN'];
var ui=isUi(savedUi)?savedUi:null;
if(!ui){for(var i=0;i<nav.length;i++){ui=browserToUi(nav[i]);if(ui)break;}}
if(!ui)ui='zh-CN';
var contentPreferred=null;
if(savedContent!==null)contentPreferred=savedContent;
else{for(var j=0;j<nav.length;j++){contentPreferred=browserToContent(nav[j]);if(contentPreferred)break;}}
var html=document.documentElement;
html.lang=ui==='zh-CN'?'zh-CN':ui==='zh-TW'?'zh-TW':ui;
html.dir=ui==='ar'?'rtl':'ltr';
window.__BLOCKS_I18N__={
  ui:ui,
  contentPreferred:contentPreferred,
  contentSaved:savedContent,
  messages:MSGS,
  uiKey:UI_KEY,
  contentKey:CONTENT_KEY,
  contentToUi:contentToUi
};
window.t=function(key,vars){
  var I=window.__BLOCKS_I18N__;
  var table=I.messages[I.ui]||I.messages.en||{};
  var s=table[key];
  if(s==null)s=(I.messages.en&&I.messages.en[key])||(I.messages['zh-CN']&&I.messages['zh-CN'][key])||key;
  if(vars){for(var k in vars){if(Object.prototype.hasOwnProperty.call(vars,k))s=s.split('{'+k+'}').join(String(vars[k]));}}
  return s;
};
})();`;
}

/** Runtime helpers: t(), applyDomI18n(), wire UI language select. */
export function clientI18nRuntimeScript(): string {
	return `
(function(){
var I=window.__BLOCKS_I18N__;
if(!I)return;
function t(key,vars){
  var table=I.messages[I.ui]||I.messages.en||{};
  var s=table[key];
  if(s==null)s=(I.messages.en&&I.messages.en[key])||(I.messages['zh-CN']&&I.messages['zh-CN'][key])||key;
  if(vars){for(var k in vars){if(Object.prototype.hasOwnProperty.call(vars,k))s=s.split('{'+k+'}').join(String(vars[k]));}}
  return s;
}
window.t=t;
function varsFromEl(el){
  var vars={};
  for(var i=0;i<el.attributes.length;i++){
    var a=el.attributes[i];
    if(a.name.indexOf('data-i18n-')===0&&a.name!=='data-i18n-placeholder'&&a.name!=='data-i18n-aria'&&a.name!=='data-i18n-title'&&a.name!=='data-i18n-html'){
      vars[a.name.slice('data-i18n-'.length)]=a.value;
    }
  }
  return vars;
}
function applyDomI18n(){
  document.querySelectorAll('[data-i18n]').forEach(function(el){
    var key=el.getAttribute('data-i18n');if(!key)return;
    el.textContent=t(key,varsFromEl(el));
  });
  document.querySelectorAll('[data-i18n-html]').forEach(function(el){
    var key=el.getAttribute('data-i18n-html');if(!key)return;
    el.innerHTML=t(key,varsFromEl(el));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(function(el){
    var key=el.getAttribute('data-i18n-placeholder');if(!key)return;
    el.setAttribute('placeholder',t(key));
  });
  document.querySelectorAll('[data-i18n-aria]').forEach(function(el){
    var key=el.getAttribute('data-i18n-aria');if(!key)return;
    el.setAttribute('aria-label',t(key));
  });
  var titleEl=document.querySelector('[data-i18n-doc-title]');
  if(titleEl){
    var tk=titleEl.getAttribute('data-i18n-doc-title');
    if(tk)document.title=t(tk)+' · EplayerX Blocks';
  }
  var uiSel=document.getElementById('uiLangSel');
  if(uiSel)uiSel.value=I.ui;
}
window.applyDomI18n=applyDomI18n;
function setUiLang(ui){
  if(!I.messages[ui])return;
  I.ui=ui;
  try{localStorage.setItem(I.uiKey,ui);}catch(e){}
  var html=document.documentElement;
  html.lang=ui==='zh-CN'?'zh-CN':ui==='zh-TW'?'zh-TW':ui;
  html.dir=ui==='ar'?'rtl':'ltr';
  applyDomI18n();
  if(typeof window.onBlocksUiLangChange==='function')window.onBlocksUiLangChange(ui);
}
window.setBlocksUiLang=setUiLang;
var uiSel=document.getElementById('uiLangSel');
if(uiSel){
  uiSel.value=I.ui;
  uiSel.addEventListener('change',function(){setUiLang(uiSel.value);});
}
applyDomI18n();
})();
`;
}
