// packages/core-engine/src/types/contracts.ts
// MaskeLex Faz-1 VERİ KONTRATLARI · sürüm 1.0.0
// DONDURULMUŞTUR. Yalnız orkestratör değiştirir. Değişiklik isteği: docs/contract-requests/AGENT-<n>-<konu>.md
// Bu dosya çalışma zamanı bağımlılığı içermez: yalnız tipler, sabitler ve saf yardımcılar.
// Tüm metin indeksleri UTF-16 kod birimidir (JS string indeksi), aralıklar [start, end) yarı açıktır.

export const CONTRACT_VERSION = '1.1.0' as const;

/* ═════════════════════════ 0. TEMEL TİPLER ═════════════════════════ */

export interface TextSpan { readonly start: number; readonly end: number }
/** Oturum içinde benzersiz kimlikler. Biçimler: "E-0001", "M-000001", "D-01", "G-01". */
export type EntityId = string;
export type MentionId = string;
export type DocumentId = string;
export type GroupId = string;
/** 128 bit kriptografik rastgele, 32 karakter hex. */
export type SessionId = string;
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';
export const CONFIDENCE_RANK: Readonly<Record<Confidence, number>> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Kriptografik rastgele kaynak. Üretimde crypto.getRandomValues; testte tohumlu sahte. Math.random YASAK. */
export interface RandomSource {
  nextUint32(): number;
  /** [0, 1) */
  nextFloat(): number;
}

/* ═════════════════════════ 1. KATEGORİLER VE ROLLER ═════════════════════════ */

export const ENTITY_CATEGORIES = [
  'KISI', 'SIRKET', 'KURUM', 'ADRES',
  'TCKN', 'YKN', 'VKN', 'MERSIS', 'PASAPORT',
  'IBAN', 'KART', 'TUTAR',
  'TELEFON', 'EPOSTA',
  'PLAKA', 'DOSYA_NO', 'TAPU', 'YEVMIYE',
  'DOGUM_TARIHI', 'OZEL',
] as const;
export type EntityCategory = (typeof ENTITY_CATEGORIES)[number];

export type CategoryGroup = 'KISI_KURUM' | 'KIMLIK' | 'FINANS' | 'ILETISIM' | 'ADRES' | 'DOSYA' | 'ARAC' | 'TARIH' | 'DIGER';
export type AgentId = 'AGENT-1' | 'AGENT-2' | 'AGENT-3' | 'AGENT-4' | 'AGENT-5';

export interface CategorySpec {
  /** Etiket gövdesi: [KİŞİ_1], [ŞİRKET_A], [TCKN_1] */
  readonly tokenLabel: string;
  readonly displayName: string;
  readonly group: CategoryGroup;
  /** apps/web/src/styles/tokens.css içindeki renk değişkeni */
  readonly colorVar: string;
  /** Tespit edildiğinde varsayılan olarak maskelenir mi */
  readonly defaultMasked: boolean;
  readonly index: 'NUMERIC' | 'ALPHA';
  /** Fonetik İkiz modunda sentetik ad alabilir mi */
  readonly twinCapable: boolean;
  /** Tespitinden sorumlu ajan */
  readonly detectorOwner: AgentId;
}

export const CATEGORY_SPECS: Readonly<Record<EntityCategory, CategorySpec>> = {
  KISI:         { tokenLabel: 'KİŞİ',         displayName: 'Kişi',              group: 'KISI_KURUM', colorVar: '--mlx-c-kisi',     defaultMasked: true,  index: 'NUMERIC', twinCapable: true,  detectorOwner: 'AGENT-2' },
  SIRKET:       { tokenLabel: 'ŞİRKET',       displayName: 'Şirket',            group: 'KISI_KURUM', colorVar: '--mlx-c-sirket',   defaultMasked: true,  index: 'ALPHA',   twinCapable: true,  detectorOwner: 'AGENT-2' },
  KURUM:        { tokenLabel: 'KURUM',        displayName: 'Kamu kurumu',       group: 'KISI_KURUM', colorVar: '--mlx-c-kurum',    defaultMasked: false, index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-2' },
  ADRES:        { tokenLabel: 'ADRES',        displayName: 'Adres',             group: 'ADRES',      colorVar: '--mlx-c-adres',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TCKN:         { tokenLabel: 'TCKN',         displayName: 'T.C. kimlik no',    group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  YKN:          { tokenLabel: 'YKN',          displayName: 'Yabancı kimlik no', group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  VKN:          { tokenLabel: 'VKN',          displayName: 'Vergi kimlik no',   group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  MERSIS:       { tokenLabel: 'MERSİS',       displayName: 'MERSİS no',         group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  PASAPORT:     { tokenLabel: 'PASAPORT',     displayName: 'Pasaport no',       group: 'KIMLIK',     colorVar: '--mlx-c-kimlik',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  IBAN:         { tokenLabel: 'IBAN',         displayName: 'IBAN',              group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  KART:         { tokenLabel: 'KART',         displayName: 'Kart no',           group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TUTAR:        { tokenLabel: 'TUTAR',        displayName: 'Tutar',             group: 'FINANS',     colorVar: '--mlx-c-finans',   defaultMasked: false, index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TELEFON:      { tokenLabel: 'TELEFON',      displayName: 'Telefon',           group: 'ILETISIM',   colorVar: '--mlx-c-iletisim', defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  EPOSTA:       { tokenLabel: 'EPOSTA',       displayName: 'E-posta / KEP',     group: 'ILETISIM',   colorVar: '--mlx-c-iletisim', defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  PLAKA:        { tokenLabel: 'PLAKA',        displayName: 'Araç plakası',      group: 'ARAC',       colorVar: '--mlx-c-plaka',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  DOSYA_NO:     { tokenLabel: 'DOSYA_NO',     displayName: 'Dosya no',          group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  TAPU:         { tokenLabel: 'TAPU',         displayName: 'Tapu kaydı',        group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  YEVMIYE:      { tokenLabel: 'YEVMİYE',      displayName: 'Noter yevmiye no',  group: 'DOSYA',      colorVar: '--mlx-c-dosya',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  DOGUM_TARIHI: { tokenLabel: 'DOĞUM_TARİHİ', displayName: 'Doğum tarihi',      group: 'TARIH',      colorVar: '--mlx-c-tarih',    defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
  OZEL:         { tokenLabel: 'GİZLİ',        displayName: 'Diğer / elle',      group: 'DIGER',      colorVar: '--mlx-c-ozel',     defaultMasked: true,  index: 'NUMERIC', twinCapable: false, detectorOwner: 'AGENT-1' },
};

export const LEGAL_ROLES = [
  'DAVACI', 'DAVALI', 'SANIK', 'SUPHELI', 'MUSTEKI', 'MAGDUR', 'KATILAN', 'TANIK', 'BILIRKISI',
  'ALACAKLI', 'BORCLU', 'MUVEKKIL', 'VEKIL', 'MIRASBIRAKAN', 'MIRASCI', 'KIRAYA_VEREN', 'KIRACI',
  'ISVEREN', 'ISCI', 'KEFIL', 'UCUNCU_KISI', 'BASVURUCU', 'MUDAHIL', 'HAKIM', 'SAVCI', 'ARABULUCU',
  'NOTER', 'BELIRSIZ',
] as const;
export type LegalRole = (typeof LEGAL_ROLES)[number];

/** Kişi etiketlerinin gövdesi. BELIRSIZ → [KİŞİ_n]. Rol değişince yeni etiket verilir, eskisi takma ad olarak kalır. */
export const ROLE_TOKEN_LABELS: Readonly<Record<LegalRole, string>> = {
  DAVACI: 'DAVACI', DAVALI: 'DAVALI', SANIK: 'SANIK', SUPHELI: 'ŞÜPHELİ', MUSTEKI: 'MÜŞTEKİ', MAGDUR: 'MAĞDUR',
  KATILAN: 'KATILAN', TANIK: 'TANIK', BILIRKISI: 'BİLİRKİŞİ', ALACAKLI: 'ALACAKLI', BORCLU: 'BORÇLU',
  MUVEKKIL: 'MÜVEKKİL', VEKIL: 'VEKİL', MIRASBIRAKAN: 'MİRASBIRAKAN', MIRASCI: 'MİRASÇI', KIRAYA_VEREN: 'KİRAYA_VEREN',
  KIRACI: 'KİRACI', ISVEREN: 'İŞVEREN', ISCI: 'İŞÇİ', KEFIL: 'KEFİL', UCUNCU_KISI: 'ÜÇÜNCÜ_KİŞİ',
  BASVURUCU: 'BAŞVURUCU', MUDAHIL: 'MÜDAHİL', HAKIM: 'HAKİM', SAVCI: 'SAVCI', ARABULUCU: 'ARABULUCU',
  NOTER: 'NOTER', BELIRSIZ: 'KİŞİ',
};

/** Rol ipuçları (küçük harf, lowerView üzerinde aranır). Uzun olan önce denenir. */
export const ROLE_CUES: ReadonlyArray<readonly [string, LegalRole]> = [
  ['davacı-karşı davalı', 'DAVACI'], ['davalı-karşı davacı', 'DAVALI'], ['suçtan zarar gören', 'MAGDUR'],
  ['kiraya veren', 'KIRAYA_VEREN'], ['üçüncü kişi', 'UCUNCU_KISI'], ['fer\'i müdahil', 'MUDAHIL'],
  ['davacı', 'DAVACI'], ['davalı', 'DAVALI'], ['sanık', 'SANIK'], ['şüpheli', 'SUPHELI'], ['müşteki', 'MUSTEKI'],
  ['mağdur', 'MAGDUR'], ['katılan', 'KATILAN'], ['tanık', 'TANIK'], ['bilirkişi', 'BILIRKISI'], ['alacaklı', 'ALACAKLI'],
  ['borçlu', 'BORCLU'], ['müvekkil', 'MUVEKKIL'], ['vekili', 'VEKIL'], ['vekil', 'VEKIL'], ['av.', 'VEKIL'],
  ['murisi', 'MIRASBIRAKAN'], ['mirasbırakan', 'MIRASBIRAKAN'], ['muris', 'MIRASBIRAKAN'], ['mirasçı', 'MIRASCI'],
  ['kiracı', 'KIRACI'], ['işveren', 'ISVEREN'], ['işçi', 'ISCI'], ['kefil', 'KEFIL'], ['başvurucu', 'BASVURUCU'],
  ['başvuran', 'BASVURUCU'], ['müdahil', 'MUDAHIL'], ['hakim', 'HAKIM'], ['hâkim', 'HAKIM'], ['savcı', 'SAVCI'],
  ['arabulucu', 'ARABULUCU'], ['noter', 'NOTER'],
];

/* ═════════════════════════ 2. TESPİT ═════════════════════════ */

export type DetectionLayer = 'L1_CHECKSUM' | 'L2_LEGAL' | 'L3_NER' | 'L3_RULE' | 'MANUAL';
/** Çakışmada yüksek olan kazanır; eşitlikte uzun aralık, sonra yüksek skor. */
export const LAYER_PRIORITY: Readonly<Record<DetectionLayer, number>> = { MANUAL: 100, L1_CHECKSUM: 90, L2_LEGAL: 80, L3_RULE: 60, L3_NER: 50 };

export type MatchFlag =
  | 'NEEDS_REVIEW' | 'OWN_CASE_SUSPECT' | 'AMBIGUOUS_SURNAME' | 'AMBIGUOUS_GIVEN_NAME' | 'UPPERCASE_CONTEXT'
  | 'SENTENCE_INITIAL' | 'CHECKSUM_FAILED' | 'NO_CONTEXT' | 'FOREIGN_NAME' | 'LEAK_AUDIT';

/** Bir dedektörün ham bulgusu (kümelemeden önce). Aralık EKİ İÇERMEZ: "Yılmaz'ın" → "Yılmaz". */
export interface EntityMatch {
  readonly id: MentionId;
  readonly docId: DocumentId;
  readonly span: TextSpan;
  readonly text: string;
  readonly category: EntityCategory;
  readonly layer: DetectionLayer;
  readonly confidence: Confidence;
  /** 0..1, NER için model skoru; kurallarda sabit (HIGH 0.95, MEDIUM 0.7, LOW 0.4). */
  readonly score: number;
  /** Kural kimliği: "L1.TCKN", "L2.DOSYA", "L3.NER.PER", "L3.RULE.ROL_IPUCU" */
  readonly ruleId: string;
  readonly roleHint?: LegalRole;
  /** Değer karşılaştırması için normal biçim: kimlik/IBAN/kart/telefon rakamları, plaka "34 ABC 123" */
  readonly normalized?: string;
  readonly honorificBefore?: 'sayın' | 'sn.' | 'bay' | 'bayan' | 'av.' | 'dr.' | 'prof.' | 'doç.';
  readonly honorificAfter?: 'bey' | 'hanım' | 'beyefendi' | 'hanımefendi';
  readonly flags: readonly MatchFlag[];
}

export type ProtectedReason = 'ICTIHAT_KUNYESI' | 'KANUN_ATFI' | 'KULLANICI';
/** Asla otomatik maskelenmeyen aralık. ownCaseSuspect=true ise arayüz "kendi dosyanız olabilir" uyarısı gösterir. */
export interface ProtectedSpan {
  readonly docId: DocumentId;
  readonly span: TextSpan;
  readonly reason: ProtectedReason;
  readonly ruleId: string;
  readonly ownCaseSuspect: boolean;
}

export interface DetectContext {
  readonly docId: DocumentId;
  readonly currentYear: number;
  readonly options: MaskingOptions;
}
export interface DetectorOutput {
  readonly matches: readonly EntityMatch[];
  readonly protectedSpans: readonly ProtectedSpan[];
}

/* ═════════════════════════ 3. SES BİLGİSİ VE BİÇİMBİLİM ═════════════════════════ */

/** Son ünlünün 4'lü uyum sınıfı: a/ı → 'ı', o/u → 'u', e/i → 'i', ö/ü → 'ü'. */
export type HarmonyVowel = 'ı' | 'i' | 'u' | 'ü';
/** Son ses: ünlü / yumuşak ünsüz / sert ünsüz (f s t k ç ş h p). */
export type FinalSound = 'VOWEL' | 'VOICED' | 'VOICELESS';
export type PhonSource = 'EVIDENCE' | 'LEXICON' | 'WORD' | 'ABBREVIATION' | 'NUMBER' | 'DEFAULT';
export interface PhonProfile {
  readonly harmony: HarmonyVowel;
  readonly final: FinalSound;
  /** 3. tekil iyelikle biten ad (Şirketi, Bakanlığı): durum ekleri n kaynaştırmalı (-nin, -ne, -nde, -nden, -nce). */
  readonly pronominalN: boolean;
  readonly source: PhonSource;
  readonly confidence: Confidence;
}
export type Morpheme =
  | 'PL' | 'POSS' | 'GEN' | 'ACC' | 'DAT' | 'LOC' | 'ABL' | 'INS' | 'EQU'
  | 'KI' | 'DIR' | 'DI' | 'MIS' | 'SA' | 'KEN' | 'LI' | 'SIZ';
export interface SuffixRealization {
  readonly suffixOut: string;
  readonly morphemes: readonly Morpheme[] | null;
  readonly changed: boolean;
  readonly confidence: Confidence;
}

/* ═════════════════════════ 4. VARLIKLAR VE KASA (VAULT) ═════════════════════════ */

export type EntityStatus = 'MASK' | 'KEEP' | 'REVIEW';
export type MentionForm = 'FULL' | 'GIVEN_ONLY' | 'SURNAME_ONLY' | 'INITIAL_SURNAME' | 'VALUE';
export type Gender = 'E' | 'K' | 'U';
export interface PersonNameParts { readonly given: readonly string[]; readonly surnames: readonly string[] }
export interface TwinName {
  /** "Kaan Korkmaz" */
  readonly full: string;
  readonly given?: string;
  readonly surname?: string;
  /** Maskeli metne yazılan biçim: "《Kaan Korkmaz》" */
  readonly display: string;
}

export interface EntityCluster {
  readonly id: EntityId;
  readonly category: EntityCategory;
  /** Kişi dışı kategorilerde 'BELIRSIZ'. */
  readonly role: LegalRole;
  readonly roleSource: 'CUE' | 'USER' | 'DEFAULT';
  /** Güncel etiket: "[DAVACI_1]" */
  readonly token: string;
  /** Panoya çıkmış tüm etiketler (takma adlar). Geri çözmede hepsi tanınır, asla silinmez. */
  readonly issuedTokens: readonly string[];
  /** Geri çözmede yazılacak biçim ("Ahmet Yılmaz"). Kullanıcı değiştirebilir. */
  readonly canonical: string;
  readonly surfaces: readonly string[];
  readonly normalizedValue?: string;
  readonly mentionIds: readonly MentionId[];
  readonly status: EntityStatus;
  readonly confidence: Confidence;
  readonly gender?: Gender;
  readonly nameParts?: PersonNameParts;
  readonly phon: PhonProfile;
  /** Yalnız adla anmalar ("Ahmet Bey") için */
  readonly givenCanonical?: string;
  readonly phonGiven?: PhonProfile;
  /** Kaynak belgede bu varlığa eklenmiş görülen ekler ("ın", "ne"); profil kanıtı. */
  readonly observedSuffixes: readonly string[];
  readonly twin?: TwinName;
}

export interface ResolvedMention {
  readonly id: MentionId;
  readonly docId: DocumentId;
  /** null ise grup etiketine bağlıdır (groupId dolu). */
  readonly entityId: EntityId | null;
  readonly groupId?: GroupId;
  readonly span: TextSpan;
  readonly surface: string;
  /** Kesme işaretli ek: "Yılmaz'ın" için { apostrophe: "'", text: "ın" } */
  readonly suffix?: { readonly span: TextSpan; readonly apostrophe: string; readonly text: string };
  readonly form: MentionForm;
  readonly match: EntityMatch;
}

/** Soyadı çakışmasında tek başına geçen ve kişiye bağlanamayan anma: [SOYAD_n] (veya ad için [AD_n]). */
export interface GroupToken {
  readonly id: GroupId;
  readonly token: string;
  readonly kind: 'SOYAD' | 'AD';
  readonly value: string;
  readonly phon: PhonProfile;
  readonly candidateIds: readonly EntityId[];
  /** İkiz modunda ailenin ortak ikiz soyadı */
  readonly twinValue?: string;
}

export interface AmountScaleRecord {
  /** Gizli ölçek. [0.95, 1.05] aralığı dışında. */
  readonly k: number;
  readonly pairs: ReadonlyArray<{ readonly entityId: EntityId; readonly fuzzed: string; readonly original: string }>;
}

export type DocumentFormat = 'udf' | 'docx' | 'txt' | 'md';

export interface VaultDocument {
  readonly id: DocumentId;
  readonly format: DocumentFormat;
  /** Özgün dosya adı kişisel veri içerebilir: yalnız arayüzde gösterilir, hiçbir çıktıya yazılmaz. */
  readonly displayName: string;
  readonly charCount: number;
}

/** Eşleşme kasası. Yalnız Engine Worker belleğinde yaşar; sunucuya, diske (şifresiz) ve loga ASLA gitmez. */
export interface MaskingSessionVault {
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly options: MaskingOptions;
  readonly documents: readonly VaultDocument[];
  readonly entities: ReadonlyMap<EntityId, EntityCluster>;
  readonly mentions: ReadonlyMap<MentionId, ResolvedMention>;
  readonly groups: ReadonlyMap<GroupId, GroupToken>;
  /** tokenKey(etiket) → varlık. Takma adlar dahil. */
  readonly tokenIndex: ReadonlyMap<string, EntityId>;
  /** foldKey(ikiz yüzeyi) → hedef */
  readonly twinIndex: ReadonlyMap<string, { readonly entityId?: EntityId; readonly groupId?: GroupId; readonly part: 'FULL' | 'GIVEN' | 'SURNAME' }>;
  /** Etiket gövdesi → son kullanılan indeks ("DAVACI" → 2) */
  readonly counters: Readonly<Record<string, number>>;
  readonly amountScale?: AmountScaleRecord;
  /** İlk kopyalamadan sonra true. Kilitliyken verilmiş etiket geri alınmaz, yeniden numaralanmaz. */
  readonly locked: boolean;
}

/* ═════════════════════════ 5. SEÇENEKLER ═════════════════════════ */

export type MaskingMode = 'TOKEN' | 'TWIN';
export type AmountMode = 'OFF' | 'TOKEN' | 'SCALE';
export interface MaskingOptions {
  readonly mode: MaskingMode;
  readonly maskedCategories: Readonly<Record<EntityCategory, boolean>>;
  readonly amountMode: AmountMode;
  readonly scaleRange: readonly [number, number];
  /** Bu güven ve üstündeki bulgular otomatik seçili gelir. */
  readonly autoSelectMinConfidence: Confidence;
  readonly reviewOwnCaseCitations: boolean;
  /** Maskeli metinde etiketten sonraki eki etiketin kendi okunuşuna göre yeniden çek ("[DAVACI_1]'in"). */
  readonly normalizeSuffixesInMaskedText: boolean;
  readonly includeHeadersFooters: boolean;
  readonly includeComments: boolean;
  readonly includeFootnotes: boolean;
  readonly nerEnabled: boolean;
  readonly sessionTimeoutMinutes: number;
  /** Hassas (çözülmüş) metin kopyalandıktan sonra pano temizleme süresi; 0 = kapalı */
  readonly clipboardClearSeconds: number;
}

const ALL_CATEGORIES_DEFAULT = Object.fromEntries(
  ENTITY_CATEGORIES.map((c) => [c, CATEGORY_SPECS[c].defaultMasked]),
) as Record<EntityCategory, boolean>;

export const DEFAULT_MASKING_OPTIONS: MaskingOptions = {
  mode: 'TOKEN',
  maskedCategories: ALL_CATEGORIES_DEFAULT,
  amountMode: 'OFF',
  scaleRange: [0.8, 1.25],
  autoSelectMinConfidence: 'MEDIUM',
  reviewOwnCaseCitations: true,
  normalizeSuffixesInMaskedText: true,
  includeHeadersFooters: false,
  includeComments: false,
  includeFootnotes: true,
  nerEnabled: true,
  sessionTimeoutMinutes: 60,
  clipboardClearSeconds: 60,
};

/* ═════════════════════════ 6. GERİ ÇÖZME (UN-MASK) ═════════════════════════ */

export type TokenVariant = 'EXACT' | 'NORMALIZED' | 'BARE' | 'TWIN' | 'TWIN_BARE' | 'TWIN_PART';
export interface UnmaskReplacement {
  /** LLM yanıtındaki aralık (ek dahil) */
  readonly inSpan: TextSpan;
  /** Çözülmüş metindeki aralık */
  readonly outSpan: TextSpan;
  readonly entityId: EntityId | null;
  readonly groupId?: GroupId;
  readonly matched: string;
  readonly restored: string;
  readonly suffixIn?: string;
  readonly suffixOut?: string;
  readonly suffixCorrected: boolean;
  readonly variant: TokenVariant;
  readonly confidence: Confidence;
}
export type UnmaskIssueKind =
  | 'UNKNOWN_TOKEN' | 'SUFFIX_UNPARSED' | 'LOW_PHON_CONFIDENCE' | 'AMOUNT_DERIVED' | 'GROUP_TOKEN'
  | 'LEFTOVER_MARKER' | 'VAULT_EXPIRED';
export interface UnmaskIssue {
  readonly kind: UnmaskIssueKind;
  readonly outSpan: TextSpan;
  readonly message: string;
  readonly suggestion?: string;
  readonly entityId?: EntityId;
}
export interface UnmaskResult {
  readonly text: string;
  readonly replacements: readonly UnmaskReplacement[];
  readonly issues: readonly UnmaskIssue[];
  readonly stats: {
    readonly tokensFound: number;
    readonly tokensResolved: number;
    readonly twinsFound: number;
    readonly suffixCorrections: number;
    readonly unknownTokens: number;
    readonly amountSuggestions: number;
  };
}

/* ═════════════════════════ 7. BELGE MODELİ (DocumentAST) ═════════════════════════ */

export type Alignment = 'left' | 'center' | 'right' | 'justify';
export interface RunStyle {
  readonly family?: string;
  readonly sizePt?: number;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly underline?: boolean;
  /** İmzalı 32 bit ARGB (UDF biçimi: siyah -16777216) */
  readonly color?: number;
  readonly background?: number;
}
export interface ParagraphStyle {
  readonly align: Alignment;
  readonly leftIndentPt?: number;
  readonly rightIndentPt?: number;
  readonly firstLineIndentPt?: number;
  readonly spaceBeforePt?: number;
  readonly spaceAfterPt?: number;
  readonly lineSpacing?: number;
  readonly heading?: 1 | 2 | 3 | 4 | 5 | 6;
  readonly list?: { readonly kind: 'bullet' | 'number'; readonly level: number };
}
export interface ParagraphBlock { readonly kind: 'paragraph'; readonly span: TextSpan; readonly style: ParagraphStyle }
export interface TableCell { readonly blocks: readonly Block[]; readonly colspan: number }
export interface TableRow { readonly cells: readonly TableCell[] }
export interface TableBlock { readonly kind: 'table'; readonly span: TextSpan; readonly rows: readonly TableRow[]; readonly columnWidthsPt?: readonly number[] }
export type Block = ParagraphBlock | TableBlock;
export interface InlineMark { readonly span: TextSpan; readonly style: RunStyle }
/** Metinde tek karakter yer kaplayan metin dışı nesne. Düzenlemeler bu karakterlere dokunamaz. */
export interface Placeholder { readonly offset: number; readonly char: '￼' | '​'; readonly kind: 'IMAGE' | 'EMPTY_PARAGRAPH' | 'OBJECT' }
export interface PageFormat {
  readonly widthPt?: number;
  readonly heightPt?: number;
  readonly marginsPt: { readonly top: number; readonly right: number; readonly bottom: number; readonly left: number };
  readonly landscape: boolean;
}
export type DocWarningCode =
  | 'SIGNATURE_PRESENT' | 'UYAP_METADATA_PRESENT' | 'TRACKED_CHANGES' | 'COMMENTS_PRESENT' | 'HEADER_FOOTER_TEXT'
  | 'IMAGES_PRESENT' | 'EMBEDDED_OBJECTS' | 'UNKNOWN_ELEMENTS' | 'OFFSET_UNIT_CODEPOINT' | 'READ_ONLY_FALLBACK' | 'MACROS_PRESENT';
export interface DocWarning { readonly code: DocWarningCode; readonly message: string }
/** Codec'e özel ham parçalar (UDF: content.xml dizgesi ve diğer ZIP girdileri). Yalnız aynı codec okur. */
export interface SourceHandle { readonly codec: DocumentFormat; readonly opaque: unknown }

/** Biçimden bağımsız belge modeli. Paragraflar text içinde '\n' ile ayrılır; tüm stiller text üzerindeki aralıklardır. */
export interface DocumentAST {
  readonly format: DocumentFormat;
  readonly text: string;
  readonly blocks: readonly Block[];
  readonly marks: readonly InlineMark[];
  readonly placeholders: readonly Placeholder[];
  readonly page?: PageFormat;
  readonly source?: SourceHandle;
  readonly warnings: readonly DocWarning[];
}

/** Ön koşullar: boş olmayan aralık, çakışma yok, '\n' / '\r' / yer tutucu içermez. İhlal: E_EDIT_INVALID. */
export interface TextEdit { readonly span: TextSpan; readonly replacement: string }

export interface WriteOptions {
  /** MASKED_EXPORT: kaynak biçim korunur, imza ve UYAP üst verisi düşürülür. UNMASKED_OUTPUT: yeni belge üretilir. */
  readonly purpose: 'MASKED_EXPORT' | 'UNMASKED_OUTPUT';
  /** Çıktı dosya adı daima nötrdür ("maskeli-7f3a.udf"); özgün ad kullanılmaz. */
  readonly fileName: string;
}

/* ═════════════════════════ 8. PORTLAR (AJAN SINIRLARI) ═════════════════════════ */

/** AGENT-1: Katman 1 + Katman 2 + adres kuralları. Senkron ve saf. */
export interface DeterministicDetectorPort {
  detect(text: string, ctx: DetectContext): DetectorOutput;
}

export interface AmountStyle { readonly thousands: '.' | ''; readonly decimals: 0 | 1 | 2 }
export interface AmountHit {
  readonly span: TextSpan;
  readonly value: number;
  readonly style: AmountStyle;
  readonly currency: string;
  /** Hemen ardından gelen yazıyla tutar: "(yüzyirmibeşbin Türk Lirası)" içindeki sayı sözcükleri */
  readonly words?: { readonly span: TextSpan; readonly text: string };
}
/** AGENT-1 */
export interface AmountFuzzerPort {
  findAmounts(text: string): readonly AmountHit[];
  pickScale(rng: RandomSource, range: readonly [number, number]): number;
  scale(text: string, hits: readonly AmountHit[], k: number): readonly TextEdit[];
}

export type NerState = 'NOT_LOADED' | 'DOWNLOADING' | 'READY' | 'FAILED' | 'DISABLED';
export interface NerStatus { readonly state: NerState; readonly progress: number; readonly modelId?: string; readonly backend?: 'wasm' | 'webgpu'; readonly error?: string }
export interface NerChunkEvent { readonly docId: DocumentId; readonly done: number; readonly total: number; readonly matches: readonly EntityMatch[] }
/** AGENT-2: NER Web Worker istemcisi. Ağ isteği yalnız aynı kökenden model dosyaları içindir. */
export interface NerPort {
  status(): NerStatus;
  load(onProgress: (s: NerStatus) => void): Promise<NerStatus>;
  detect(text: string, docId: DocumentId, onChunk: (e: NerChunkEvent) => void, signal?: AbortSignal): Promise<readonly EntityMatch[]>;
  dispose(): Promise<void>;
}
/** AGENT-2: model dışı ad/şirket kuralları (rol ipucu, ad sözlüğü, şirket tür ekleri). */
export interface NameRuleDetectorPort {
  detect(text: string, ctx: DetectContext): readonly EntityMatch[];
}

export interface CorefInput {
  readonly docs: ReadonlyArray<{ readonly docId: DocumentId; readonly text: string }>;
  /** KISI/SIRKET/KURUM bulguları, birleştirme (merge) sonrası, çakışmasız */
  readonly matches: readonly EntityMatch[];
  readonly existing: readonly EntityCluster[];
}
export interface CorefOutput {
  readonly clusters: ReadonlyArray<{
    readonly key: string;
    readonly category: EntityCategory;
    readonly role: LegalRole;
    readonly roleSource: 'CUE' | 'DEFAULT';
    readonly canonical: string;
    readonly givenCanonical?: string;
    readonly gender: Gender;
    readonly nameParts?: PersonNameParts;
    readonly mentionIds: readonly MentionId[];
    readonly confidence: Confidence;
    readonly existingEntityId?: EntityId;
  }>;
  readonly groups: ReadonlyArray<{ readonly kind: 'SOYAD' | 'AD'; readonly value: string; readonly mentionIds: readonly MentionId[]; readonly candidateKeys: readonly string[] }>;
  readonly forms: ReadonlyMap<MentionId, MentionForm>;
}
/** AGENT-2 */
export interface CorefPort { resolve(input: CorefInput): CorefOutput }

/** AGENT-2 */
export interface MorphologyPort {
  profileOf(surface: string): PhonProfile;
  refineWithEvidence(computed: PhonProfile, observedSuffixes: readonly string[]): PhonProfile;
  tokenReadingProfile(token: string): PhonProfile;
  parseSuffix(suffix: string): readonly Morpheme[] | null;
  realize(morphemes: readonly Morpheme[], stem: Pick<PhonProfile, 'harmony' | 'final' | 'pronominalN'>): string;
  rehydrateSuffix(llmSuffix: string, target: PhonProfile): SuffixRealization;
}
/** AGENT-2 */
export interface TwinPort {
  assign(entities: readonly EntityCluster[], groups: readonly GroupToken[], rng: RandomSource): {
    readonly twins: ReadonlyMap<EntityId, TwinName>;
    readonly groupTwins: ReadonlyMap<GroupId, string>;
  };
}
/** AGENT-2 */
export interface RehydratorPort { unmask(response: string, vault: MaskingSessionVault): UnmaskResult }

/** AGENT-3 */
export interface DocumentCodec {
  readonly format: DocumentFormat;
  sniff(bytes: Uint8Array, fileName: string): boolean;
  read(bytes: Uint8Array): Promise<DocumentAST>;
  /** Metni düzenler ve TÜM aralıkları (blok, işaret, yer tutucu, kaynak ofsetleri) yeniden eşler. */
  applyEdits(ast: DocumentAST, edits: readonly TextEdit[]): DocumentAST;
  write(ast: DocumentAST, opts: WriteOptions): Promise<Uint8Array>;
}
/** AGENT-3: LLM yanıtındaki yalın Markdown'ı (#, **, *, listeler, tablolar) AST'ye çevirir. */
export type MarkdownToAst = (markdown: string) => DocumentAST;

/** AGENT-5: Kasa deposu. Yalnız Engine Worker içinde örneklenir. */
export interface VaultStorePort {
  create(options: MaskingOptions, rng: RandomSource): MaskingSessionVault;
  get(): MaskingSessionVault | null;
  update(mutator: (v: MaskingSessionVault) => MaskingSessionVault): MaskingSessionVault;
  /** En iyi çaba sıfırlama: tipli dizileri sıfırla, Map'leri boşalt, referansları bırak. */
  wipe(reason: WipeReason): void;
  exportEncrypted(passphrase: string): Promise<Uint8Array>;
  importEncrypted(bytes: Uint8Array, passphrase: string): Promise<MaskingSessionVault>;
}
export type WipeReason = 'USER' | 'TIMEOUT' | 'PAGEHIDE' | 'NEW_SESSION' | 'PANIC';

/** Şifreli kasa dosyası (.mlxkasa) biçimi. Düz metin alan içermez. */
export interface EncryptedVaultFile {
  readonly v: 1;
  readonly kdf: 'PBKDF2-SHA256';
  readonly iterations: number;     // en az 600000
  readonly salt: string;           // base64, 16 bayt
  readonly iv: string;             // base64, 12 bayt
  readonly ciphertext: string;     // base64, AES-256-GCM (etiket dahil)
}

/** AGENT-4 (web) ve AGENT-5 (masaüstü) */
export type Sensitivity = 'MASKED' | 'SENSITIVE';
export interface PlatformAdapter {
  readonly kind: 'web' | 'desktop';
  readonly capabilities: {
    /** Pano geçmişi / bulut eşitlemesi dışında tutulabiliyor mu */
    readonly concealedClipboard: boolean;
    /** İşletim sistemi düzeyinde ağ yasağı (macOS sandbox) */
    readonly osNetworkSandbox: boolean;
  };
  copyText(text: string, sensitivity: Sensitivity): Promise<{ readonly ok: boolean; readonly fingerprint: string }>;
  /** Pano hâlâ aynı içeriği taşıyorsa temizler. */
  clearClipboardIfUnchanged(fingerprint: string): Promise<boolean>;
  saveFile(file: { readonly name: string; readonly mime: string; readonly bytes: Uint8Array }): Promise<{ readonly ok: boolean }>;
  setCloseGuard(enabled: boolean): void;
  /** Web: sayfayı yeniden yükler. Masaüstü: webview'i yeniden oluşturur. */
  hardReset(): Promise<void>;
}

export type NetworkRealm = 'main' | 'engine-worker' | 'ner-worker' | 'service-worker';
export type NetworkKind = 'fetch' | 'xhr' | 'websocket' | 'eventsource' | 'beacon' | 'resource' | 'csp-violation' | 'webrtc';
export interface NetworkEvent {
  readonly at: number;
  readonly realm: NetworkRealm;
  readonly kind: NetworkKind;
  readonly url: string;
  readonly sameOrigin: boolean;
  readonly blocked: boolean;
  readonly bytes?: number;
}
/** AGENT-4 */
export interface NetworkMonitorPort {
  install(realm: NetworkRealm): void;
  events(): readonly NetworkEvent[];
  subscribe(cb: (e: NetworkEvent) => void): () => void;
  externalAttempts(): number;
}

/* ═════════════════════════ 9. MOTOR API'Sİ (Engine Worker RPC, Comlink) ═════════════════════════ */

export type DocumentInput =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'file'; readonly fileName: string; readonly bytes: Uint8Array };

export interface ReviewItem {
  readonly id: string;
  readonly kind: 'LOW_CONFIDENCE' | 'OWN_CASE_CITATION' | 'GROUP_TOKEN' | 'LEAK_AUDIT' | 'FOREIGN_NAME' | 'DOC_WARNING';
  readonly docId: DocumentId;
  readonly span?: TextSpan;
  readonly entityId?: EntityId;
  readonly groupId?: GroupId;
  readonly message: string;
}

export interface AnalysisResult {
  readonly docId: DocumentId;
  readonly text: string;
  readonly entities: readonly EntityCluster[];
  readonly mentions: readonly ResolvedMention[];
  readonly groups: readonly GroupToken[];
  readonly protectedSpans: readonly ProtectedSpan[];
  readonly reviewQueue: readonly ReviewItem[];
  readonly ner: NerStatus;
  readonly phase: 'DETERMINISTIC' | 'NER_PARTIAL' | 'COMPLETE';
  readonly timingsMs: Readonly<Record<string, number>>;
}

export type EntityCommand =
  | { readonly type: 'SET_STATUS'; readonly entityId: EntityId; readonly status: EntityStatus }
  | { readonly type: 'SET_ROLE'; readonly entityId: EntityId; readonly role: LegalRole }
  | { readonly type: 'SET_CATEGORY'; readonly entityId: EntityId; readonly category: EntityCategory }
  | { readonly type: 'SET_CANONICAL'; readonly entityId: EntityId; readonly canonical: string }
  | { readonly type: 'MERGE'; readonly sourceId: EntityId; readonly targetId: EntityId }
  | { readonly type: 'DETACH_MENTION'; readonly mentionId: MentionId }
  | { readonly type: 'ASSIGN_MENTION'; readonly mentionId: MentionId; readonly entityId: EntityId }
  | { readonly type: 'RESOLVE_GROUP'; readonly groupId: GroupId; readonly mentionId: MentionId; readonly entityId: EntityId }
  | { readonly type: 'ADD_MANUAL'; readonly docId: DocumentId; readonly span: TextSpan; readonly category: EntityCategory; readonly role?: LegalRole; readonly applyToAll: boolean }
  | { readonly type: 'REMOVE_MENTION'; readonly mentionId: MentionId }
  | { readonly type: 'UNPROTECT'; readonly docId: DocumentId; readonly span: TextSpan }
  | { readonly type: 'SET_OPTIONS'; readonly patch: Partial<MaskingOptions> }
  /** 1.1.0: Sızıntı bulgusunu kullanıcı açıkça onaylar ("Sorun değil"). span kaynak belgededir. */
  | { readonly type: 'ACK_LEAK'; readonly docId: DocumentId; readonly span: TextSpan };

export interface PromptTemplate {
  readonly id: string;
  readonly title: string;
  /** {{GOREV}} ve {{MASKELI_METIN}} yer tutucularını içerir. */
  readonly body: string;
  readonly builtIn: boolean;
}

export interface MaskedOutput {
  readonly docId: DocumentId;
  readonly text: string;
  readonly withTemplate?: string;
  readonly tokenCount: number;
  /** Sızıntı denetimi sonucu: boş değilse kopyalama ve maskeli dosya engellenir. Onaylanan (ACK_LEAK) bulgular
   *  listede yer almaz. 1.1.0: bulgu aralıkları KAYNAK belgededir (maskeli metinde değil). */
  readonly leakFindings: readonly ReviewItem[];
}

export interface SessionInfo {
  readonly sessionId: SessionId;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly locked: boolean;
  readonly documents: readonly VaultDocument[];
}

export interface ExportRequest {
  readonly source: 'MASKED' | 'UNMASKED';
  readonly docId?: DocumentId;
  /** UNMASKED için çözülmüş metin (Markdown olabilir) */
  readonly text?: string;
  readonly format: 'udf' | 'docx' | 'txt';
}

/** Ana iş parçacığının çağırdığı tek yüzey. Tüm yöntemler Engine Worker'da çalışır. */
export interface MaskingEngineApi {
  createSession(options?: Partial<MaskingOptions>): Promise<SessionInfo>;
  loadDocument(input: DocumentInput): Promise<{ readonly docId: DocumentId; readonly text: string; readonly warnings: readonly DocWarning[] }>;
  analyze(docId: DocumentId, onUpdate: (r: AnalysisResult) => void): Promise<AnalysisResult>;
  command(cmd: EntityCommand): Promise<AnalysisResult>;
  buildMasked(docId: DocumentId, templateId?: string, task?: string): Promise<MaskedOutput>;
  /** Kopyalama yapıldığında çağrılır: kasayı kilitler (etiketler kalıcılaşır). */
  markIssued(docId: DocumentId): Promise<SessionInfo>;
  unmask(response: string): Promise<UnmaskResult>;
  exportFile(req: ExportRequest): Promise<{ readonly fileName: string; readonly mime: string; readonly bytes: Uint8Array }>;
  exportVault(passphrase: string): Promise<Uint8Array>;
  importVault(bytes: Uint8Array, passphrase: string): Promise<SessionInfo>;
  extendSession(): Promise<SessionInfo>;
  wipe(reason: WipeReason): Promise<void>;
  nerStatus(): Promise<NerStatus>;
}

/* ═════════════════════════ 10. HATALAR ═════════════════════════ */

export type ErrorCode =
  | 'E_UNSUPPORTED_FORMAT' | 'E_UDF_FORMAT' | 'E_DOCX_FORMAT' | 'E_EDIT_INVALID' | 'E_VAULT_EXPIRED'
  | 'E_VAULT_LOCKED' | 'E_NO_SESSION' | 'E_NER_UNAVAILABLE' | 'E_LEAK_DETECTED' | 'E_CRYPTO' | 'E_PLATFORM';
/** İleti kullanıcı metni İÇERMEZ (log politikası). */
export interface MaskelexError { readonly code: ErrorCode; readonly message: string }
export const isMaskelexError = (x: unknown): x is MaskelexError =>
  typeof x === 'object' && x !== null && typeof (x as { code?: unknown }).code === 'string' && (x as { code: string }).code.startsWith('E_');

/* ═════════════════════════ 11. ALTIN TEST SETİ (AGENT-5 üretir, herkes kullanır) ═════════════════════════ */

export interface GoldenEntity {
  readonly span: TextSpan;
  readonly category: EntityCategory;
  readonly role?: LegalRole;
  /** Aynı kişiye ait anmalar aynı anahtarı taşır ("P1") */
  readonly clusterKey?: string;
}
export interface GoldenUnmaskCase {
  /** Maskeli metinde etiketler deterministik atanır (tohum 42). Beklenen çıktı birebir karşılaştırılır. */
  readonly llmOutput: string;
  readonly expected: string;
}
export interface GoldenCase {
  readonly id: string;
  readonly title: string;
  readonly tags: readonly string[];
  readonly input: { readonly text: string } | { readonly fixture: string };
  readonly entities: readonly GoldenEntity[];
  /** Kesinlikle maskelenmemesi gereken aralıklar (içtihat, kanun atfı) */
  readonly mustKeep: readonly TextSpan[];
  readonly unmask?: readonly GoldenUnmaskCase[];
}

/* ═════════════════════════ 12. SAF YARDIMCILAR ═════════════════════════ */

/** Etiketi kasa anahtarına çevirir: "[Davacı_1]", "DAVACI 1", "\[DAVACI\_1\]", "[ŞIRKET_A]" → "DAVACI_1" / "SIRKET_A". */
export function tokenKey(raw: string): string {
  const s = raw.replace(/\\/g, '').replace(/^\[|\]$/g, '').trim().toLocaleLowerCase('tr-TR');
  const folded = s.replace(/[ıİ]/g, 'i').replace(/ğ/g, 'g').replace(/[üû]/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o')
    .replace(/ç/g, 'c').replace(/â/g, 'a').replace(/î/g, 'i').normalize('NFD').replace(/̇/g, '').normalize('NFC');
  return folded.toUpperCase().replace(/[\s.\-]+/g, '_').replace(/_+/g, '_');
}

/** Alfabetik indeks: 1 → A, 26 → Z, 27 → AA */
export function alphaIndex(n: number): string {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function makeToken(label: string, index: number, style: 'NUMERIC' | 'ALPHA'): string {
  return `[${label}_${style === 'ALPHA' ? alphaIndex(index) : String(index)}]`;
}

export const spansOverlap = (a: TextSpan, b: TextSpan): boolean => a.start < b.end && b.start < a.end;
