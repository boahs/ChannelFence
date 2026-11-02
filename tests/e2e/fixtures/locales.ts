import en from "../../../_locales/en/messages.json";
import ko from "../../../_locales/ko/messages.json";
import ja from "../../../_locales/ja/messages.json";
import ptBR from "../../../_locales/pt_BR/messages.json";
import ru from "../../../_locales/ru/messages.json";
import es from "../../../_locales/es/messages.json";
import fr from "../../../_locales/fr/messages.json";
import de from "../../../_locales/de/messages.json";
import zhCN from "../../../_locales/zh_CN/messages.json";
import zhTW from "../../../_locales/zh_TW/messages.json";
import hi from "../../../_locales/hi/messages.json";
import id from "../../../_locales/id/messages.json";
import bn from "../../../_locales/bn/messages.json";
import tr from "../../../_locales/tr/messages.json";
import vi from "../../../_locales/vi/messages.json";
import ar from "../../../_locales/ar/messages.json";
import it from "../../../_locales/it/messages.json";
import nl from "../../../_locales/nl/messages.json";

// Browser UI language and YouTube's hl parameter are independent settings.
export const translatedLocales = [
  {
    name: "Korean", catalogCode: "ko", browserLocale: "ko-KR", uiLanguage: /^ko(?:-|$)/,
    youtubeLanguage: "ko", documentLanguage: /^ko(?:-|$)/, messages: ko,
    creator: "한국채널", collaborators: ["첫번째채널", "두번째채널"],
    goToChannel: "한국채널 채널로 이동", moreActions: "추가 작업",
    views: "조회수 1회", age: "23시간 전", conjunction: "및"
  },
  {
    name: "Japanese", catalogCode: "ja", browserLocale: "ja-JP", uiLanguage: /^ja(?:-|$)/,
    youtubeLanguage: "ja", documentLanguage: /^ja(?:-|$)/, messages: ja,
    creator: "日本の料理", collaborators: ["最初のチャンネル", "次のチャンネル"],
    goToChannel: "日本の料理 のチャンネルに移動", moreActions: "その他の操作",
    views: "1回視聴", age: "23時間前", conjunction: "と"
  },
  {
    name: "Brazilian Portuguese", catalogCode: "pt_BR", browserLocale: "pt-BR", uiLanguage: /^pt-BR$/i,
    youtubeLanguage: "pt-BR", documentLanguage: /^pt(?:-BR)?$/i, messages: ptBR,
    creator: "cozinhação", collaborators: ["primeirocanal", "segundocanal"],
    goToChannel: "Acessar o canal cozinhação", moreActions: "Mais ações",
    views: "1 visualização", age: "há 23 horas", conjunction: "e"
  },
  {
    name: "Russian", catalogCode: "ru", browserLocale: "ru-RU", uiLanguage: /^ru(?:-|$)/,
    youtubeLanguage: "ru", documentLanguage: /^ru(?:-|$)/, messages: ru,
    creator: "русскаякухня", collaborators: ["первыйканал", "второйканал"],
    goToChannel: "Перейти на канал русскаякухня", moreActions: "Ещё",
    views: "1 просмотр", age: "23 часа назад", conjunction: "и"
  },
  {
    name: "Spanish", catalogCode: "es", browserLocale: "es-ES", uiLanguage: /^es(?:-|$)/,
    youtubeLanguage: "es", documentLanguage: /^es(?:-|$)/, messages: es,
    creator: "cocinaespañola", collaborators: ["primercanal", "segundocanal"],
    goToChannel: "Ir al canal cocinaespañola", moreActions: "Más acciones",
    views: "1 visualización", age: "hace 23 horas", conjunction: "y"
  },
  {
    name: "French", catalogCode: "fr", browserLocale: "fr-FR", uiLanguage: /^fr(?:-|$)/,
    youtubeLanguage: "fr", documentLanguage: /^fr(?:-|$)/, messages: fr,
    creator: "cuisinefrançaise", collaborators: ["premièrechaîne", "deuxièmechaîne"],
    goToChannel: "cuisinefrançaise. Accéder à la chaîne.", moreActions: "Autres actions",
    views: "1 vue", age: "il y a 23 heures", conjunction: "et"
  },
  {
    name: "German", catalogCode: "de", browserLocale: "de-DE", uiLanguage: /^de(?:-|$)/,
    youtubeLanguage: "de", documentLanguage: /^de(?:-|$)/, messages: de,
    creator: "küchenkanal", collaborators: ["ersterkanal", "zweiterkanal"],
    goToChannel: "Zu Kanal „küchenkanal“", moreActions: "Mehr Aktionen",
    views: "1 Aufruf", age: "vor 23 Stunden", conjunction: "und"
  },
  {
    name: "Simplified Chinese", catalogCode: "zh_CN", browserLocale: "zh-CN",
    uiLanguage: /^zh-(?:CN|Hans(?:-CN)?)$/i,
    youtubeLanguage: "zh-CN", documentLanguage: /^zh-(?:CN|Hans(?:-CN)?)$/i, messages: zhCN,
    creator: "中华美食", collaborators: ["第一个频道", "第二个频道"],
    goToChannel: "前往频道：中华美食", moreActions: "其他操作",
    views: "1次观看", age: "23小时前", conjunction: "和"
  },
  {
    name: "Traditional Chinese", catalogCode: "zh_TW", browserLocale: "zh-TW",
    uiLanguage: /^zh-(?:TW|Hant(?:-TW)?)$/i,
    youtubeLanguage: "zh-TW", documentLanguage: /^zh-(?:TW|Hant(?:-TW)?)$/i, messages: zhTW,
    creator: "中華美食", collaborators: ["第一個頻道", "第二個頻道"],
    goToChannel: "前往頻道：中華美食", moreActions: "其他動作",
    views: "觀看次數：1次", age: "23 小時前", conjunction: "和"
  },
  {
    name: "Hindi", catalogCode: "hi", browserLocale: "hi-IN", uiLanguage: /^hi(?:-|$)/,
    youtubeLanguage: "hi", documentLanguage: /^hi(?:-|$)/, messages: hi,
    creator: "भारतीयरसोई", collaborators: ["पहलाचैनल", "दूसराचैनल"],
    goToChannel: "भारतीयरसोई. चैनल पर जाएं.", moreActions: "ज़्यादा कार्रवाईयां",
    views: "1 व्यू", age: "23 घंटे पहले", conjunction: "और"
  },
  {
    name: "Indonesian", catalogCode: "id", browserLocale: "id-ID", uiLanguage: /^id(?:-|$)/,
    youtubeLanguage: "id", documentLanguage: /^id(?:-|$)/, messages: id,
    creator: "dapurindonesia", collaborators: ["kanalpertama", "kanalkedua"],
    goToChannel: "dapurindonesia. Buka channel.", moreActions: "Tindakan lainnya",
    views: "1 kali ditonton", age: "23 jam yang lalu", conjunction: "dan"
  },
  {
    name: "Bengali", catalogCode: "bn", browserLocale: "bn-BD", uiLanguage: /^bn(?:-|$)/,
    youtubeLanguage: "bn", documentLanguage: /^bn(?:-|$)/, messages: bn,
    creator: "বাংলারান্না", collaborators: ["চ্যানেলএক", "চ্যানেলদুই"],
    goToChannel: "বাংলারান্না. চ্যানেলে যাওয়ার বোতাম।", moreActions: "আরও ক্রিয়া",
    views: "১ বার দেখা হয়েছে", age: "২৩ ঘণ্টা আগে", conjunction: "ও"
  },
  {
    name: "Turkish", catalogCode: "tr", browserLocale: "tr-TR", uiLanguage: /^tr(?:-|$)/,
    youtubeLanguage: "tr", documentLanguage: /^tr(?:-|$)/, messages: tr,
    creator: "türkmutfağı", collaborators: ["birincikanal", "ikincikanal"],
    goToChannel: "türkmutfağı kanalına git", moreActions: "Daha fazla işlem",
    views: "1 görüntüleme", age: "23 saat önce", conjunction: "ve"
  },
  {
    name: "Vietnamese", catalogCode: "vi", browserLocale: "vi-VN", uiLanguage: /^vi(?:-|$)/,
    youtubeLanguage: "vi", documentLanguage: /^vi(?:-|$)/, messages: vi,
    creator: "bếpviệt", collaborators: ["kênhđầutiên", "kênhthứhai"],
    goToChannel: "Kênh bếpviệt. Chuyển đến kênh.", moreActions: "Thao tác khác",
    views: "1 lượt xem", age: "23 giờ trước", conjunction: "và"
  },
  {
    name: "Arabic", catalogCode: "ar", browserLocale: "ar", uiLanguage: /^ar(?:-|$)/,
    youtubeLanguage: "ar", documentLanguage: /^ar(?:-|$)/, messages: ar,
    creator: "المطبخالعربي", collaborators: ["القناةالأولى", "القناةالثانية"],
    goToChannel: "الانتقال إلى قناة المطبخالعربي", moreActions: "مزيد من الإجراءات",
    views: "مشاهدة واحدة", age: "قبل 23 ساعة", conjunction: "و"
  },
  {
    name: "Italian", catalogCode: "it", browserLocale: "it-IT", uiLanguage: /^it(?:-|$)/,
    youtubeLanguage: "it", documentLanguage: /^it(?:-|$)/, messages: it,
    creator: "cucinacaffè", collaborators: ["primocanale", "secondocanale"],
    goToChannel: "Vai al canale cucinacaffè", moreActions: "Altre azioni",
    views: "1 visualizzazione", age: "23 ore fa", conjunction: "e"
  },
  {
    name: "Dutch", catalogCode: "nl", browserLocale: "nl-NL", uiLanguage: /^nl(?:-|$)/,
    youtubeLanguage: "nl", documentLanguage: /^nl(?:-|$)/, messages: nl,
    creator: "nederlandsekeuken", collaborators: ["eerstekanaal", "tweedekanaal"],
    goToChannel: "Ga naar kanaal nederlandsekeuken", moreActions: "Meer acties",
    views: "1 weergave", age: "23 uur geleden", conjunction: "en"
  }
];

export const allLocales = [
  {
    name: "English", catalogCode: "en", browserLocale: "en-US", uiLanguage: /^en(?:-|$)/,
    youtubeLanguage: "en", documentLanguage: /^en(?:-|$)/, messages: en,
    creator: "examplecreator", collaborators: ["firstcreator", "secondcreator"],
    goToChannel: "Go to channel examplecreator", moreActions: "More actions",
    views: "1 view", age: "23 hours ago", conjunction: "and"
  },
  ...translatedLocales
];
