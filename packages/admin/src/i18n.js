/**
 * i18n — 轻量国际化（零依赖）
 *
 * 支持：zh-CN / en / ja
 * 使用：$t('nav.dashboard') → 'Dashboard'
 *
 * 语言检测优先级：
 *   1. localStorage 'taichu_lang'
 *   2. TAICHU_LANG 环境变量（通过 window.__TAICHU_LANG__ 注入）
 *   3. 浏览器 navigator.language
 *   4. 默认 'en'
 */

import { ref } from 'vue';

// Inline locale data (avoid build-time JSON import issues)
const messages = {
  en: {"app":{"title":"Taichu CMS","logo":"⚡ Taichu"},"nav":{"dashboard":"Dashboard","media":"Media Library","apikeys":"API Keys","logout":"Logout"},"login":{"title":"Login","username":"Username","password":"Password","submit":"Login","register_link":"Create account","error_invalid":"Invalid username or password"},"register":{"title":"Register","username":"Username","email":"Email","password":"Password","submit":"Register","login_link":"Already have an account? Login","error_taken":"Username already taken"},"dashboard":{"title":"Dashboard","welcome":"Welcome to Taichu CMS","total_content":"Total Content","content_types":"Content Types","recent":"Recent Updates"},"content":{"title":"Content","new":"New","edit":"Edit","save_draft":"Save Draft","publish":"Publish","delete":"Delete","delete_confirm":"Delete this item?","field_title":"Title","field_slug":"Slug","field_body":"Body","field_status":"Status","no_items":"No content yet","create_first":"Create your first item"},"media":{"title":"Media Library","upload":"Upload File","uploading":"Uploading...","copy_url":"Copy URL","delete":"Delete","no_items":"No media files yet","size_label":"Size","url_copied":"URL copied"},"apikeys":{"title":"API Keys","generate":"Generate New Key","label":"Label","scopes":"Scopes","prefix":"Prefix","created":"Created","revoke":"Revoke","revoke_confirm":"This key will be permanently revoked. Continue?","copy_warning":"Copy this key now — it will not be shown again","no_keys":"No API keys yet","scope_all":"All Permissions","scope_read":"Read Only","scope_hint":"Default: read all. Select \"*:*\" for admin."},"common":{"save":"Save","cancel":"Cancel","confirm":"Confirm","loading":"Loading...","error":"Error","back":"Back","search":"Search","no_results":"No results"}},
  "zh-CN": {"app":{"title":"Taichu CMS","logo":"⚡ Taichu"},"nav":{"dashboard":"仪表盘","media":"媒体库","apikeys":"API Keys","logout":"退出"},"login":{"title":"登录","username":"用户名","password":"密码","submit":"登录","register_link":"注册账号","error_invalid":"用户名或密码错误"},"register":{"title":"注册","username":"用户名","email":"邮箱","password":"密码","submit":"注册","login_link":"已有账号？去登录","error_taken":"用户名已被占用"},"dashboard":{"title":"仪表盘","welcome":"欢迎使用 Taichu CMS","total_content":"内容总数","content_types":"内容类型","recent":"最近更新"},"content":{"title":"内容","new":"新建","edit":"编辑","save_draft":"保存草稿","publish":"发布","delete":"删除","delete_confirm":"确认删除？","field_title":"标题","field_slug":"Slug","field_body":"正文","field_status":"状态","no_items":"暂无内容","create_first":"创建第一篇内容"},"media":{"title":"媒体库","upload":"上传文件","uploading":"上传中...","copy_url":"复制链接","delete":"删除","no_items":"暂无媒体文件","size_label":"大小","url_copied":"链接已复制"},"apikeys":{"title":"API Keys","generate":"生成新 Key","label":"标签","scopes":"权限范围","prefix":"前缀","created":"创建时间","revoke":"撤销","revoke_confirm":"撤销后该 Key 立即失效，确认？","copy_warning":"⚠️ 复制此 Key，关闭后不可查看","no_keys":"暂无 API Key","scope_all":"全部权限","scope_read":"只读","scope_hint":"默认：只读所有内容。选中 \"*:*\" 为管理员权限。"},"common":{"save":"保存","cancel":"取消","confirm":"确认","loading":"加载中...","error":"错误","back":"返回","search":"搜索","no_results":"无结果"}},
  ja: {"app":{"title":"Taichu CMS","logo":"⚡ Taichu"},"nav":{"dashboard":"ダッシュボード","media":"メディアライブラリ","apikeys":"API キー","logout":"ログアウト"},"login":{"title":"ログイン","username":"ユーザー名","password":"パスワード","submit":"ログイン","register_link":"アカウント作成","error_invalid":"ユーザー名またはパスワードが無効です"},"register":{"title":"登録","username":"ユーザー名","email":"メールアドレス","password":"パスワード","submit":"登録","login_link":"アカウントをお持ちですか？ログイン","error_taken":"このユーザー名は既に使用されています"},"dashboard":{"title":"ダッシュボード","welcome":"Taichu CMS へようこそ","total_content":"総コンテンツ数","content_types":"コンテンツタイプ","recent":"最近の更新"},"content":{"title":"コンテンツ","new":"新規作成","edit":"編集","save_draft":"下書き保存","publish":"公開","delete":"削除","delete_confirm":"削除してもよろしいですか？","field_title":"タイトル","field_slug":"スラッグ","field_body":"本文","field_status":"ステータス","no_items":"コンテンツがありません","create_first":"最初のコンテンツを作成"},"media":{"title":"メディアライブラリ","upload":"ファイルをアップロード","uploading":"アップロード中...","copy_url":"URL をコピー","delete":"削除","no_items":"メディアファイルがありません","size_label":"サイズ","url_copied":"URL をコピーしました"},"apikeys":{"title":"API キー","generate":"新しいキーを生成","label":"ラベル","scopes":"権限範囲","prefix":"プレフィックス","created":"作成日時","revoke":"無効化","revoke_confirm":"このキーは永久に無効化されます。続行しますか？","copy_warning":"⚠️ このキーをコピーしてください。再度表示されません","no_keys":"API キーがありません","scope_all":"全権限","scope_read":"読み取り専用","scope_hint":"デフォルト：読み取り専用。\"*:*\" を選択すると管理者権限になります。"},"common":{"save":"保存","cancel":"キャンセル","confirm":"確認","loading":"読み込み中...","error":"エラー","back":"戻る","search":"検索","no_results":"結果がありません"}}
};

const LOCALE_MAP = {
  'zh': 'zh-CN', 'zh-cn': 'zh-CN', 'zh-hans': 'zh-CN', 'zh-hant': 'zh-CN',
  'ja': 'ja', 'jp': 'ja',
  'en': 'en', 'en-us': 'en', 'en-gb': 'en'
};

const SUPPORTED = [
  { code: 'zh-CN', label: '中文', flag: '🇨🇳' },
  { code: 'en',    label: 'English', flag: '🇺🇸' },
  { code: 'ja',    label: '日本語', flag: '🇯🇵' }
];

function detectLang() {
  try {
    const stored = localStorage.getItem('taichu_lang');
    if (stored && messages[stored]) return stored;
  } catch { /* localStorage not available */ }
  if (typeof window !== 'undefined' && window.__TAICHU_LANG__ && messages[window.__TAICHU_LANG__]) return window.__TAICHU_LANG__;
  if (typeof navigator !== 'undefined') {
    const browser = navigator.language?.toLowerCase();
    const mapped = LOCALE_MAP[browser];
    if (mapped && messages[mapped]) return mapped;
    if (browser?.startsWith('zh')) return 'zh-CN';
    if (browser?.startsWith('ja')) return 'ja';
  }
  return 'en';
}

const currentLocale = ref(detectLang());

function t(key) {
  const locale = currentLocale.value;
  const msg = messages[locale] || messages.en;
  return key.split('.').reduce((o, k) => (o || {})[k], msg) || key;
}

function setLocale(code) {
  if (messages[code]) {
    currentLocale.value = code;
    try { localStorage.setItem('taichu_lang', code); } catch {}
  }
}

export function useI18n() {
  return { t, locale: currentLocale, setLocale, supportedLocales: SUPPORTED };
}
