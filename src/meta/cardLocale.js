/**
 * Card name + effect text overlays. English defs stay the source of truth;
 * ES/JA apply phrase tables so every printed card localizes without a 1.3k-row pack.
 */
import { getLocale } from "./i18n.js";

function pairs(map) {
  return Object.entries(map).sort((a, b) => b[0].length - a[0].length);
}

const NAME_ES = {
  "Grinning Imp": "Diablillo sonriente",
  Imp: "Diablillo",
  Fox: "Zorro",
  Drake: "Draco",
  Knight: "Caballero",
  Titan: "Titán",
  Wisp: "Fuego fatuo",
  Sentinel: "Centinela",
  Warden: "Guardián",
  Courier: "Mensajero",
  Offering: "Ofrenda",
  Spark: "Chispa",
  Ember: "Brasa",
  Grove: "Arboleda",
  Swarm: "Enjambre",
  Walls: "Muros",
  Engine: "Motor",
  Flood: "Inundación",
  Rush: "Embestida",
  Burn: "Quemadura",
  Stall: "Estancamiento",
  Heal: "Cura",
  Mill: "Molino",
  Control: "Control",
  Tempo: "Tempo",
  Midrange: "Rango medio",
  Evolve: "Evolucionar",
  Fusion: "Fusión",
  Counter: "Contra",
  Spell: "Hechizo",
  Trap: "Trampa",
  Lane: "Carril",
  Field: "Campo"
};

const NAME_JA = {
  "Grinning Imp": "Grinning Imp",
  Imp: "インプ",
  Fox: "フォックス",
  Drake: "ドレイク",
  Knight: "ナイト",
  Titan: "タイタン",
  Wisp: "ウィスプ",
  Sentinel: "センチネル",
  Warden: "ワーデン",
  Courier: "クーリエ",
  Offering: "供物",
  Spark: "スパーク",
  Ember: "エンバー",
  Grove: "グローブ",
  Swarm: "スウォーム",
  Walls: "ウォール",
  Engine: "エンジン",
  Flood: "フラッド",
  Rush: "ラッシュ",
  Burn: "バーン",
  Stall: "ストール",
  Heal: "ヒール",
  Mill: "ミル",
  Control: "コントロール",
  Tempo: "テンポ",
  Midrange: "ミッドレンジ",
  Evolve: "進化",
  Fusion: "融合",
  Counter: "カウンター",
  Spell: "魔法",
  Trap: "罠",
  Lane: "レーン",
  Field: "フィールド"
};

const TEXT_ES = {
  "Special Summon": "Invocar de Modo Especial",
  "Normal Summon": "Invocación Normal",
  "once per turn": "una vez por turno",
  "until end of turn": "hasta el final del turno",
  "from your deck to your hand": "de tu mazo a tu mano",
  "from your deck": "de tu mazo",
  "from your hand": "de tu mano",
  "from your GY": "de tu Cementerio",
  "from the field to your GY": "del campo a tu Cementerio",
  "from the field to the GY": "del campo al Cementerio",
  "sent to the GY": "mandada al Cementerio",
  "sent from the field": "mandada del campo",
  "both players": "ambos jugadores",
  "enemy leader": "líder enemigo",
  "enemy monster": "monstruo enemigo",
  "enemy monsters": "monstruos enemigos",
  "your battling monster": "tu monstruo en batalla",
  "this card is summoned": "esta carta es invocada",
  "this card is sent": "esta carta es mandada",
  "you can": "puedes",
  "you activate a spell": "activas un hechizo",
  "destroy 1": "destruye 1",
  "destroy all": "destruye todos",
  "draw 1 card": "roba 1 carta",
  "draw 2 cards": "roba 2 cartas",
  "discard this card": "descarta esta carta",
  "Tribute this card": "Sacrifica esta carta",
  "deal 1 damage": "inflige 1 daño",
  "deal 2 damage": "inflige 2 daño",
  "deal 3 damage": "inflige 3 daño",
  "take 1 damage": "recibe 1 daño",
  "Level 4 or lower": "Nivel 4 o menor",
  "Level 5 or lower": "Nivel 5 o menor",
  "During damage calculation": "Durante el cálculo de daño",
  "Quick-Play": "Juego Rápido",
  "Continuous": "Continua",
  Ignition: "Ignición",
  Evolve: "Evoluciona",
  Mandatory: "Obligatorio",
  Counter: "Contra",
  monster: "monstruo",
  spell: "hechizo",
  "the GY": "el Cementerio",
  "your GY": "tu Cementerio",
  GY: "Cementerio",
  ATK: "ATK",
  DEF: "DEF",
  LP: "LP",
  Ward: "Ward",
  Rush: "Rush",
  Drain: "Drain",
  Ambush: "Emboscada"
};

const TEXT_JA = {
  "Special Summon": "特殊召喚",
  "Normal Summon": "通常召喚",
  "once per turn": "1ターンに1度",
  "until end of turn": "ターン終了時まで",
  "from your deck to your hand": "デッキから手札に加える",
  "from your deck": "デッキから",
  "from your hand": "手札から",
  "from your GY": "自分の墓地から",
  "from the field to your GY": "フィールドから自分の墓地へ",
  "from the field to the GY": "フィールドから墓地へ",
  "sent to the GY": "墓地へ送られた",
  "sent from the field": "フィールドから墓地へ送られた",
  "both players": "お互いのプレイヤー",
  "enemy leader": "相手リーダー",
  "enemy monster": "相手モンスター",
  "enemy monsters": "相手モンスター",
  "your battling monster": "戦闘中の自分のモンスター",
  "this card is summoned": "このカードが召喚に成功した",
  "this card is sent": "このカードが墓地へ送られた",
  "you can": "できる",
  "you activate a spell": "魔法を発動した",
  "destroy 1": "1体破壊する",
  "destroy all": "すべて破壊する",
  "draw 1 card": "カードを1枚ドローする",
  "draw 2 cards": "カードを2枚ドローする",
  "discard this card": "このカードを捨てる",
  "Tribute this card": "このカードをリリースする",
  "deal 1 damage": "1ダメージを与える",
  "deal 2 damage": "2ダメージを与える",
  "deal 3 damage": "3ダメージを与える",
  "take 1 damage": "1ダメージを受ける",
  "Level 4 or lower": "レベル4以下",
  "Level 5 or lower": "レベル5以下",
  "During damage calculation": "ダメージ計算時",
  "Quick-Play": "速攻",
  "Continuous": "永続",
  Ignition: "起動",
  Evolve: "進化",
  Mandatory: "強制",
  Counter: "カウンター",
  monster: "モンスター",
  spell: "魔法",
  "the GY": "墓地",
  "your GY": "自分の墓地",
  GY: "墓地",
  ATK: "攻撃力",
  DEF: "守備力",
  LP: "LP",
  Ward: "Ward",
  Rush: "ラッシュ",
  Drain: "ドレイン",
  Ambush: "アンブッシュ"
};

const NAME_TABLE = { es: pairs(NAME_ES), ja: pairs(NAME_JA) };
const TEXT_TABLE = { es: pairs(TEXT_ES), ja: pairs(TEXT_JA) };

function apply(text, table) {
  if (!text || !table) return text || "";
  let out = String(text);
  for (const [en, loc] of table) {
    if (!en) continue;
    out = out.split(en).join(loc);
  }
  return out;
}

export function cardName(def) {
  const name = def?.name || "";
  const loc = getLocale();
  if (loc === "en" || !name) return name;
  return apply(name, NAME_TABLE[loc]) || name;
}

export function cardText(def) {
  const text = def?.text || "";
  const loc = getLocale();
  if (loc === "en" || !text) return text;
  return apply(text, TEXT_TABLE[loc]) || text;
}

export function laneName(def) {
  return cardName(def);
}

export function laneText(def) {
  return cardText(def);
}
