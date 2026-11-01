import ko from "../../../_locales/ko/messages.json";
import ja from "../../../_locales/ja/messages.json";
import ptBR from "../../../_locales/pt_BR/messages.json";
import ru from "../../../_locales/ru/messages.json";

// Browser UI language and YouTube's hl parameter are independent settings.
export const translatedLocales = [
  {
    name: "Korean", browserLocale: "ko-KR", uiLanguage: /^ko(?:-|$)/,
    youtubeLanguage: "ko", documentLanguage: /^ko(?:-|$)/, messages: ko,
    creator: "한국채널", collaborators: ["첫번째채널", "두번째채널"],
    goToChannel: "한국채널 채널로 이동", moreActions: "추가 작업",
    views: "조회수 1회", age: "23시간 전", conjunction: "및"
  },
  {
    name: "Japanese", browserLocale: "ja-JP", uiLanguage: /^ja(?:-|$)/,
    youtubeLanguage: "ja", documentLanguage: /^ja(?:-|$)/, messages: ja,
    creator: "日本の料理", collaborators: ["最初のチャンネル", "次のチャンネル"],
    goToChannel: "日本の料理 のチャンネルに移動", moreActions: "その他の操作",
    views: "1回視聴", age: "23時間前", conjunction: "と"
  },
  {
    name: "Brazilian Portuguese", browserLocale: "pt-BR", uiLanguage: /^pt-BR$/i,
    youtubeLanguage: "pt-BR", documentLanguage: /^pt(?:-BR)?$/i, messages: ptBR,
    creator: "cozinhação", collaborators: ["primeirocanal", "segundocanal"],
    goToChannel: "Acessar o canal cozinhação", moreActions: "Mais ações",
    views: "1 visualização", age: "há 23 horas", conjunction: "e"
  },
  {
    name: "Russian", browserLocale: "ru-RU", uiLanguage: /^ru(?:-|$)/,
    youtubeLanguage: "ru", documentLanguage: /^ru(?:-|$)/, messages: ru,
    creator: "русскаякухня", collaborators: ["первыйканал", "второйканал"],
    goToChannel: "Перейти на канал русскаякухня", moreActions: "Другие действия",
    views: "1 просмотр", age: "23 часа назад", conjunction: "и"
  }
];
