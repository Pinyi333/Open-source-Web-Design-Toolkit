/**
 * The option catalogue for the Image Prompt Builder.
 *
 * Like the Site Planner's industry templates, these are opinions written down
 * so they can be argued with in a pull request. Industry ids match
 * lib/planner where the two overlap, so a site plan and its imagery can share
 * one vocabulary.
 *
 * Prompt fragments are written to read well when joined into a sentence:
 * lower case, no trailing punctuation.
 */

import type {
  IndustryOption,
  OptionGroup,
  PaletteOption,
  PromptOption,
  RatioOption,
  ShotOption,
  StyleOption,
} from "./types";

// --- palettes ---------------------------------------------------------------

export const PALETTES: PaletteOption[] = [
  { id: "warm-earth", zh: "大地暖色", en: "Warm earth", prompt: "warm earthy tones of terracotta, sand and walnut brown", promptZh: "陶土、沙色與胡桃棕的大地暖色調", swatches: ["#8B5E3C", "#C8865A", "#E9D8C4", "#4A3B2F"] },
  { id: "nordic-neutral", zh: "北歐中性", en: "Nordic neutral", prompt: "soft neutral palette of off-white, oat and light grey", promptZh: "米白、燕麥與淺灰的北歐中性色", swatches: ["#F4F1EC", "#DDD6CB", "#B9B4AC", "#6E6A64"] },
  { id: "monochrome", zh: "黑白單色", en: "Monochrome", prompt: "monochrome black and white palette with deep contrast", promptZh: "高對比的黑白單色", swatches: ["#0E0E0E", "#4A4A4A", "#A8A8A8", "#F5F5F5"] },
  { id: "tech-blue", zh: "科技藍", en: "Tech blue", prompt: "cool palette of deep navy, electric blue and clean white", promptZh: "深海軍藍、電光藍與純白的冷調科技色", swatches: ["#0B1B3F", "#1F4FFF", "#5FA8FF", "#F2F6FF"] },
  { id: "silver-industrial", zh: "金屬銀灰", en: "Industrial silver", prompt: "brushed aluminium silver, graphite grey and a single cyan accent", promptZh: "拉絲鋁銀、石墨灰搭配一點青色點綴", swatches: ["#2B2F36", "#6B7480", "#C9CED6", "#22D3EE"] },
  { id: "forest-green", zh: "森林綠", en: "Forest green", prompt: "natural greens of moss, sage and deep forest", promptZh: "苔蘚、鼠尾草與深林的自然綠", swatches: ["#1F3B2C", "#3F6B4E", "#8DAA8B", "#E6EDE3"] },
  { id: "mint-fresh", zh: "薄荷清新", en: "Fresh mint", prompt: "fresh airy palette of mint, aqua and white", promptZh: "薄荷、水藍與白的清新配色", swatches: ["#E8FBF5", "#9EE6CF", "#3CC6B4", "#0F7C79"] },
  { id: "ocean", zh: "海洋藍綠", en: "Ocean", prompt: "ocean palette of teal, turquoise and sea-foam", promptZh: "藍綠、土耳其藍與浪花白的海洋色", swatches: ["#063B4C", "#0E7C86", "#4FC3C7", "#DDF4F2"] },
  { id: "pastel", zh: "粉嫩馬卡龍", en: "Pastel", prompt: "soft pastel palette of blush pink, lavender and butter yellow", promptZh: "嫩粉、薰衣草紫與奶油黃的馬卡龍色", swatches: ["#F9D5DC", "#D9C8F5", "#FFF1B8", "#C8E7F5"] },
  { id: "sunset", zh: "日落橘紅", en: "Sunset", prompt: "sunset palette of coral, tangerine and dusty rose", promptZh: "珊瑚、橘子與乾燥玫瑰的日落色", swatches: ["#FF6B4A", "#FFA552", "#F2B5A7", "#5B2A3C"] },
  { id: "burgundy", zh: "酒紅復古", en: "Burgundy", prompt: "rich vintage palette of burgundy, mustard and cream", promptZh: "酒紅、芥末黃與奶油白的復古色", swatches: ["#5E1A2B", "#9C2F45", "#D9A441", "#F3E7D3"] },
  { id: "luxury-gold", zh: "黑金奢華", en: "Black & gold", prompt: "luxurious black and champagne gold palette", promptZh: "黑色與香檳金的奢華配色", swatches: ["#0A0A0A", "#2A2622", "#B8925A", "#E8D3A8"] },
  { id: "vivid-pop", zh: "高飽和撞色", en: "Vivid pop", prompt: "bold saturated colour-blocking in cobalt, hot pink and lemon", promptZh: "鈷藍、桃紅與檸檬黃的高飽和撞色", swatches: ["#1E3AFF", "#FF2E88", "#FFE53B", "#111111"] },
  { id: "neon-cyber", zh: "霓虹賽博", en: "Neon cyber", prompt: "neon magenta and cyan glowing against near-black", promptZh: "近黑背景上發光的霓虹洋紅與青色", swatches: ["#07060F", "#3B0A6B", "#FF2BD6", "#2BF3FF"] },
];

// --- styles -------------------------------------------------------------------

export const STYLES: StyleOption[] = [
  { id: "editorial", zh: "雜誌編輯攝影", en: "Editorial photo", medium: "photo", prompt: "editorial photograph in the style of a premium magazine spread", promptZh: "高級雜誌跨頁風格的編輯攝影" },
  { id: "cinematic", zh: "電影感", en: "Cinematic", medium: "photo", prompt: "cinematic film still with anamorphic depth and subtle grain", promptZh: "帶變形寬銀幕景深與細緻顆粒的電影劇照感" },
  { id: "studio-product", zh: "棚拍商品", en: "Studio product", medium: "photo", prompt: "high-end studio product photograph on a seamless backdrop", promptZh: "無縫背景的高階棚拍商品攝影" },
  { id: "lifestyle", zh: "生活風格", en: "Lifestyle", medium: "photo", prompt: "authentic lifestyle photograph with candid, natural moments", promptZh: "真實自然、捕捉日常瞬間的生活風格攝影" },
  { id: "documentary", zh: "紀實攝影", en: "Documentary", medium: "photo", prompt: "documentary-style photograph, honest and unstaged", promptZh: "真實不擺拍的紀實攝影" },
  { id: "minimal", zh: "極簡留白", en: "Minimal", medium: "photo", prompt: "minimalist photograph with generous negative space and clean lines", promptZh: "大量留白、線條乾淨的極簡攝影" },
  { id: "luxury", zh: "精品奢華", en: "Luxury", medium: "photo", prompt: "luxury campaign photograph with refined textures and polished surfaces", promptZh: "質感細膩、表面光潔的精品形象攝影" },
  { id: "retro-film", zh: "底片復古", en: "Retro film", medium: "photo", prompt: "nostalgic 35mm film photograph with soft halation and analogue colour", promptZh: "柔和光暈與類比色彩的 35mm 底片復古攝影" },
  { id: "3d-render", zh: "3D 渲染", en: "3D render", medium: "render", prompt: "photorealistic 3D render with physically based materials", promptZh: "使用物理材質的寫實 3D 渲染" },
  { id: "isometric", zh: "等角 3D", en: "Isometric", medium: "render", prompt: "clean isometric 3D illustration with soft shadows", promptZh: "帶柔和陰影的乾淨等角 3D 插圖" },
  { id: "clay", zh: "黏土質感", en: "Clay", medium: "render", prompt: "playful claymorphism 3D render with soft rounded forms", promptZh: "圓潤柔軟的黏土質感 3D 渲染" },
  { id: "tech-abstract", zh: "科技抽象", en: "Tech abstract", medium: "render", prompt: "abstract technology visual of flowing light lines, particles and glass", promptZh: "流動光線、粒子與玻璃構成的抽象科技視覺" },
  { id: "flat-illustration", zh: "扁平插畫", en: "Flat illustration", medium: "illustration", prompt: "modern flat vector illustration with simple shapes", promptZh: "簡潔幾何的現代扁平向量插畫" },
  { id: "line-art", zh: "線條插畫", en: "Line art", medium: "illustration", prompt: "elegant single-weight line art illustration", promptZh: "單一線寬的優雅線條插畫" },
  { id: "watercolor", zh: "水彩手繪", en: "Watercolour", medium: "illustration", prompt: "delicate watercolour painting with soft bleeding edges", promptZh: "邊緣自然暈染的細膩水彩手繪" },
  { id: "bauhaus", zh: "包浩斯幾何", en: "Bauhaus", medium: "illustration", prompt: "Bauhaus-inspired geometric poster composition", promptZh: "包浩斯風格的幾何海報構成" },
];

// --- moods --------------------------------------------------------------------

export const MOODS: PromptOption[] = [
  { id: "calm", zh: "寧靜", en: "Calm", prompt: "calm and serene", promptZh: "寧靜安定" },
  { id: "warm", zh: "溫暖", en: "Warm", prompt: "warm and inviting", promptZh: "溫暖親切" },
  { id: "fresh", zh: "清新", en: "Fresh", prompt: "fresh and airy", promptZh: "清新透氣" },
  { id: "premium", zh: "高級", en: "Premium", prompt: "premium and sophisticated", promptZh: "高級精緻" },
  { id: "trustworthy", zh: "專業信賴", en: "Trustworthy", prompt: "professional and trustworthy", promptZh: "專業可信賴" },
  { id: "futuristic", zh: "未來感", en: "Futuristic", prompt: "futuristic and innovative", promptZh: "前衛未來" },
  { id: "energetic", zh: "活力", en: "Energetic", prompt: "energetic and dynamic", promptZh: "充滿活力與動感" },
  { id: "bold", zh: "大膽", en: "Bold", prompt: "bold and confident", promptZh: "大膽自信" },
  { id: "playful", zh: "俏皮", en: "Playful", prompt: "playful and joyful", promptZh: "俏皮歡樂" },
  { id: "romantic", zh: "浪漫", en: "Romantic", prompt: "romantic and dreamy", promptZh: "浪漫夢幻" },
  { id: "nostalgic", zh: "懷舊", en: "Nostalgic", prompt: "nostalgic and timeless", promptZh: "懷舊雋永" },
  { id: "mysterious", zh: "神秘", en: "Mysterious", prompt: "mysterious and moody", promptZh: "神秘深沉" },
];

// --- shots ----------------------------------------------------------------------

export const SHOTS: ShotOption[] = [
  { id: "wide", zh: "大遠景", en: "Wide shot", prompt: "wide establishing shot showing the whole setting", promptZh: "交代整體環境的大遠景", lens: "24mm wide-angle lens", lensZh: "24mm 廣角鏡頭" },
  { id: "medium", zh: "中景", en: "Medium shot", prompt: "medium shot showing the subject with some of its surroundings", promptZh: "主體連同部分周遭環境的中景", lens: "50mm lens", lensZh: "50mm 標準鏡頭" },
  { id: "close-up", zh: "特寫", en: "Close-up", prompt: "close-up that fills the frame with the subject", promptZh: "主體填滿畫面的特寫", lens: "85mm lens, shallow depth of field", lensZh: "85mm 鏡頭、淺景深" },
  { id: "macro", zh: "微距", en: "Macro", prompt: "extreme macro detail revealing texture", promptZh: "呈現材質細節的極近微距", lens: "100mm macro lens", lensZh: "100mm 微距鏡頭" },
  { id: "flat-lay", zh: "俯拍平鋪", en: "Flat lay", prompt: "top-down flat lay arrangement", promptZh: "正上方俯拍的平鋪構圖", lens: "overhead camera, 35mm lens", lensZh: "正上方機位、35mm 鏡頭" },
  { id: "three-quarter", zh: "45 度斜角", en: "Three-quarter", prompt: "three-quarter angle view showing depth and form", promptZh: "展現立體感的 45 度斜角", lens: "70mm lens", lensZh: "70mm 鏡頭" },
  { id: "low-angle", zh: "低角度仰拍", en: "Low angle", prompt: "low-angle hero shot looking up at the subject", promptZh: "由下往上仰拍的英雄視角", lens: "28mm lens", lensZh: "28mm 鏡頭" },
  { id: "eye-level", zh: "平視視角", en: "Eye level", prompt: "eye-level perspective that feels natural and direct", promptZh: "自然直接的平視視角", lens: "35mm lens", lensZh: "35mm 鏡頭" },
  { id: "aerial", zh: "空拍鳥瞰", en: "Aerial", prompt: "aerial bird's-eye view from high above", promptZh: "高空俯瞰的空拍鳥瞰", lens: "drone camera", lensZh: "空拍機" },
  { id: "over-shoulder", zh: "過肩鏡頭", en: "Over the shoulder", prompt: "over-the-shoulder view that puts the viewer in the scene", promptZh: "讓觀者身歷其境的過肩鏡頭", lens: "50mm lens", lensZh: "50mm 鏡頭" },
  { id: "symmetry", zh: "正面對稱", en: "Symmetrical", prompt: "centred, perfectly symmetrical composition", promptZh: "置中且完全對稱的構圖", lens: "35mm lens", lensZh: "35mm 鏡頭" },
  { id: "negative-space", zh: "留白構圖（放文字）", en: "Negative space", prompt: "subject placed off-centre with wide empty space for headline text", promptZh: "主體偏一側、留出大片空白可放標題文字", lens: "35mm lens", lensZh: "35mm 鏡頭" },
];

// --- lighting -------------------------------------------------------------------

export const LIGHTING: PromptOption[] = [
  { id: "window", zh: "自然窗光", en: "Window light", prompt: "soft natural window light", promptZh: "柔和的自然窗光" },
  { id: "golden-hour", zh: "黃金時刻", en: "Golden hour", prompt: "warm golden-hour sunlight with long shadows", promptZh: "拉長影子的溫暖黃金時刻陽光" },
  { id: "blue-hour", zh: "藍調時刻", en: "Blue hour", prompt: "cool blue-hour twilight with glowing practical lights", promptZh: "城市燈光亮起的冷調藍調時刻" },
  { id: "overcast", zh: "陰天漫射", en: "Overcast", prompt: "even, diffused overcast light", promptZh: "均勻柔和的陰天漫射光" },
  { id: "softbox", zh: "棚燈柔光", en: "Softbox", prompt: "clean studio softbox lighting", promptZh: "乾淨的棚燈柔光箱打光" },
  { id: "high-key", zh: "高調明亮", en: "High key", prompt: "bright high-key lighting with minimal shadows", promptZh: "陰影極少的明亮高調光" },
  { id: "low-key", zh: "低調暗調", en: "Low key", prompt: "dramatic low-key lighting with deep shadows", promptZh: "深邃陰影的戲劇性低調光" },
  { id: "rim", zh: "輪廓光", en: "Rim light", prompt: "crisp rim lighting that outlines the subject", promptZh: "勾勒主體輪廓的邊緣光" },
  { id: "chiaroscuro", zh: "明暗對比", en: "Chiaroscuro", prompt: "painterly chiaroscuro light and shadow", promptZh: "如油畫般的強烈明暗對比" },
  { id: "neon", zh: "霓虹燈光", en: "Neon", prompt: "glowing neon light spill and reflections", promptZh: "霓虹燈的光暈與反射" },
];

// --- aspect ratios ----------------------------------------------------------------

export const RATIOS: RatioOption[] = [
  { id: "16:9", zh: "16:9 網站橫幅", en: "16:9 Hero banner", prompt: "16:9", promptZh: "16:9", value: 16 / 9 },
  { id: "21:9", zh: "21:9 超寬主視覺", en: "21:9 Ultra-wide", prompt: "21:9", promptZh: "21:9", value: 21 / 9 },
  { id: "3:2", zh: "3:2 文章配圖", en: "3:2 Article", prompt: "3:2", promptZh: "3:2", value: 3 / 2 },
  { id: "4:3", zh: "4:3 簡報／卡片", en: "4:3 Card", prompt: "4:3", promptZh: "4:3", value: 4 / 3 },
  { id: "1:1", zh: "1:1 社群方圖", en: "1:1 Square", prompt: "1:1", promptZh: "1:1", value: 1 },
  { id: "4:5", zh: "4:5 IG 貼文", en: "4:5 Portrait post", prompt: "4:5", promptZh: "4:5", value: 4 / 5 },
  { id: "9:16", zh: "9:16 限動／直式", en: "9:16 Story", prompt: "9:16", promptZh: "9:16", value: 9 / 16 },
];

// --- industries -------------------------------------------------------------------

export const INDUSTRIES: IndustryOption[] = [
  {
    id: "restaurant", zh: "餐飲", en: "Restaurant & café",
    prompt: "for a restaurant and café brand, with appetising food styling", promptZh: "餐飲品牌用圖，食物擺盤誘人",
    keywords: ["餐", "咖啡", "café", "cafe", "coffee", "restaurant", "food", "甜點", "dessert", "料理", "麵包", "bakery", "茶", "tea", "酒吧", "bar", "火鍋", "拉麵", "早午餐", "brunch"],
    subjects: [{ en: "a beautifully plated signature dish on a wooden table", zh: "木桌上精心擺盤的招牌料理" }, { en: "a barista pouring latte art in a cosy café", zh: "溫馨咖啡館裡咖啡師正在拉花" }],
    recommends: { palette: ["warm-earth", "burgundy", "nordic-neutral"], style: ["editorial", "lifestyle", "retro-film"], mood: ["warm", "nostalgic", "calm"], shot: ["flat-lay", "close-up", "three-quarter"], lighting: ["window", "golden-hour", "low-key"], ratio: ["16:9", "4:5", "1:1"] },
  },
  {
    id: "ecommerce", zh: "電商零售", en: "E-commerce & retail",
    prompt: "for an online store, showing the product clearly and desirably", promptZh: "電商商品用圖，清楚呈現商品並引起購買慾",
    keywords: ["電商", "商品", "product", "shop", "store", "retail", "零售", "包裝", "packaging", "網購", "賣場", "禮盒"],
    subjects: [{ en: "a hero product standing on a sculptural pedestal", zh: "立在造型展台上的主打商品" }, { en: "an unboxing moment with premium packaging", zh: "精緻包裝的開箱瞬間" }],
    recommends: { palette: ["nordic-neutral", "pastel", "vivid-pop"], style: ["studio-product", "minimal", "3d-render"], mood: ["fresh", "premium", "playful"], shot: ["three-quarter", "close-up", "flat-lay"], lighting: ["softbox", "high-key", "rim"], ratio: ["1:1", "4:5", "16:9"] },
  },
  {
    id: "saas", zh: "SaaS／軟體", en: "SaaS & software",
    prompt: "for a software product website, conveying clarity and capability", promptZh: "軟體產品官網用圖，傳達清晰與效率",
    keywords: ["saas", "軟體", "software", "app", "平台", "platform", "dashboard", "ai", "人工智慧", "雲端", "cloud", "數據", "data", "系統"],
    subjects: [{ en: "a floating interface of glass panels and data cards", zh: "漂浮的玻璃介面面板與數據卡片" }, { en: "a focused team collaborating around a laptop", zh: "圍著筆電專注協作的團隊" }],
    recommends: { palette: ["tech-blue", "nordic-neutral", "neon-cyber"], style: ["3d-render", "isometric", "tech-abstract"], mood: ["futuristic", "trustworthy", "fresh"], shot: ["three-quarter", "negative-space", "eye-level"], lighting: ["softbox", "rim", "high-key"], ratio: ["16:9", "21:9", "4:3"] },
  },
  {
    id: "corporate", zh: "企業形象", en: "Corporate",
    prompt: "for a corporate brand website, conveying scale and credibility", promptZh: "企業形象官網用圖，傳達規模與可信度",
    keywords: ["企業", "公司", "corporate", "company", "集團", "品牌", "brand", "顧問", "consulting", "律師", "law", "會計", "辦公"],
    subjects: [{ en: "a modern glass headquarters building at dusk", zh: "黃昏時分的現代玻璃總部大樓" }, { en: "confident professionals in a bright meeting room", zh: "明亮會議室裡自信的專業人士" }],
    recommends: { palette: ["tech-blue", "monochrome", "nordic-neutral"], style: ["editorial", "minimal", "documentary"], mood: ["trustworthy", "premium", "calm"], shot: ["low-angle", "wide", "negative-space"], lighting: ["blue-hour", "window", "overcast"], ratio: ["16:9", "21:9", "3:2"] },
  },
  {
    id: "manufacturing", zh: "工業製造", en: "Manufacturing & industrial tech",
    prompt: "for a B2B manufacturing and industrial technology company, precise and engineered", promptZh: "B2B 工業製造與科技廠商用圖，精密且具工程感",
    keywords: ["製造", "工業", "工廠", "factory", "manufacturing", "industrial", "半導體", "semiconductor", "晶片", "chip", "散熱", "cooling", "液冷", "零組件", "component", "機械", "machine", "自動化", "automation", "電動車", "ev", "伺服器", "server"],
    subjects: [{ en: "a precision-machined metal component with intricate detail", zh: "細節精密的金屬加工零組件" }, { en: "a clean, automated production line with robotic arms", zh: "潔淨自動化產線與機械手臂" }],
    recommends: { palette: ["silver-industrial", "tech-blue", "monochrome"], style: ["studio-product", "3d-render", "tech-abstract"], mood: ["trustworthy", "futuristic", "bold"], shot: ["macro", "three-quarter", "wide"], lighting: ["rim", "low-key", "softbox"], ratio: ["16:9", "21:9", "3:2"] },
  },
  {
    id: "portfolio", zh: "創意作品集", en: "Creative portfolio",
    prompt: "for a creative studio portfolio, expressive and distinctive", promptZh: "創意工作室作品集用圖，具表現力與辨識度",
    keywords: ["作品集", "portfolio", "設計師", "designer", "工作室", "studio", "攝影師", "photographer", "藝術", "art", "插畫家", "illustrator", "創意", "creative"],
    subjects: [{ en: "an artist's desk with sketches, swatches and tools", zh: "散落草圖、色票與工具的創作者桌面" }, { en: "an abstract sculptural composition", zh: "抽象的雕塑感構成" }],
    recommends: { palette: ["monochrome", "vivid-pop", "pastel"], style: ["bauhaus", "editorial", "clay"], mood: ["bold", "playful", "mysterious"], shot: ["flat-lay", "symmetry", "negative-space"], lighting: ["chiaroscuro", "softbox", "window"], ratio: ["4:5", "3:2", "1:1"] },
  },
  {
    id: "healthcare", zh: "醫療健康", en: "Healthcare",
    prompt: "for a healthcare provider, reassuring, clean and human", promptZh: "醫療健康機構用圖，令人安心、潔淨且有溫度",
    keywords: ["醫療", "醫院", "診所", "clinic", "hospital", "health", "牙醫", "dental", "藥", "pharma", "照護", "care", "健康", "長照", "復健"],
    subjects: [{ en: "a caring doctor talking with a patient", zh: "親切醫師與病患交談" }, { en: "a bright, calm clinic waiting area", zh: "明亮平靜的診所候診區" }],
    recommends: { palette: ["mint-fresh", "nordic-neutral", "ocean"], style: ["lifestyle", "minimal", "flat-illustration"], mood: ["trustworthy", "calm", "warm"], shot: ["medium", "eye-level", "negative-space"], lighting: ["window", "high-key", "overcast"], ratio: ["16:9", "3:2", "4:3"] },
  },
  {
    id: "beauty", zh: "美妝保養", en: "Beauty & skincare",
    prompt: "for a beauty and skincare brand, radiant and tactile", promptZh: "美妝保養品牌用圖，光澤透亮且有觸感",
    keywords: ["美妝", "保養", "beauty", "skincare", "化妝", "cosmetic", "香水", "perfume", "精華", "serum", "美容", "spa", "美甲", "nail"],
    subjects: [{ en: "a glass serum bottle with water droplets and petals", zh: "沾著水珠與花瓣的玻璃精華瓶" }, { en: "glowing skin in a soft beauty close-up", zh: "柔光下透亮肌膚的美妝特寫" }],
    recommends: { palette: ["pastel", "nordic-neutral", "luxury-gold"], style: ["studio-product", "luxury", "minimal"], mood: ["fresh", "premium", "romantic"], shot: ["close-up", "macro", "three-quarter"], lighting: ["softbox", "high-key", "rim"], ratio: ["4:5", "1:1", "16:9"] },
  },
  {
    id: "fashion", zh: "時尚服飾", en: "Fashion",
    prompt: "for a fashion label, stylish with strong attitude", promptZh: "時尚服飾品牌用圖，有型且有態度",
    keywords: ["時尚", "服飾", "fashion", "服裝", "apparel", "穿搭", "outfit", "鞋", "shoes", "包", "bag", "珠寶", "jewelry", "飾品"],
    subjects: [{ en: "a model in a statement outfit striding through the city", zh: "穿著亮眼服裝在城市中邁步的模特兒" }, { en: "a curated still life of accessories", zh: "精心陳列的配件靜物" }],
    recommends: { palette: ["monochrome", "burgundy", "vivid-pop"], style: ["editorial", "cinematic", "retro-film"], mood: ["bold", "premium", "romantic"], shot: ["low-angle", "medium", "wide"], lighting: ["golden-hour", "rim", "chiaroscuro"], ratio: ["4:5", "9:16", "3:2"] },
  },
  {
    id: "real-estate", zh: "房地產／建築", en: "Real estate & architecture",
    prompt: "for a real estate and architecture brand, spacious and aspirational", promptZh: "房地產與建築品牌用圖，空間寬敞令人嚮往",
    keywords: ["房地產", "建案", "real estate", "property", "建築", "architecture", "室內", "interior", "住宅", "home", "飯店式", "公寓", "apartment", "豪宅", "villa", "裝潢"],
    subjects: [{ en: "a sunlit living room with floor-to-ceiling windows", zh: "落地窗灑滿陽光的客廳" }, { en: "a contemporary residence glowing at dusk", zh: "黃昏亮燈的當代住宅外觀" }],
    recommends: { palette: ["nordic-neutral", "warm-earth", "luxury-gold"], style: ["editorial", "minimal", "3d-render"], mood: ["calm", "premium", "warm"], shot: ["wide", "symmetry", "aerial"], lighting: ["golden-hour", "window", "blue-hour"], ratio: ["16:9", "21:9", "3:2"] },
  },
  {
    id: "hospitality", zh: "旅宿觀光", en: "Travel & hospitality",
    prompt: "for a hotel and travel brand, evoking escape and discovery", promptZh: "旅宿觀光品牌用圖，喚起出走與探索的嚮往",
    keywords: ["旅", "飯店", "hotel", "民宿", "旅行", "travel", "觀光", "tourism", "度假", "resort", "露營", "camping", "海島", "island"],
    subjects: [{ en: "an infinity pool overlooking a tropical coastline", zh: "俯瞰熱帶海岸的無邊際泳池" }, { en: "a traveller looking out over misty mountains", zh: "眺望雲霧山景的旅人" }],
    recommends: { palette: ["ocean", "sunset", "forest-green"], style: ["cinematic", "lifestyle", "editorial"], mood: ["calm", "romantic", "fresh"], shot: ["wide", "aerial", "over-shoulder"], lighting: ["golden-hour", "blue-hour", "overcast"], ratio: ["21:9", "16:9", "9:16"] },
  },
  {
    id: "education", zh: "教育學習", en: "Education",
    prompt: "for an education brand, encouraging curiosity and growth", promptZh: "教育品牌用圖，激發好奇心與成長",
    keywords: ["教育", "學校", "school", "education", "課程", "course", "補習", "學習", "learning", "大學", "university", "兒童", "kids", "線上課"],
    subjects: [{ en: "students engaged in a hands-on project", zh: "投入動手做專題的學生" }, { en: "an open book transforming into ideas and shapes", zh: "翻開的書本化為想法與圖形" }],
    recommends: { palette: ["pastel", "mint-fresh", "vivid-pop"], style: ["flat-illustration", "lifestyle", "isometric"], mood: ["playful", "fresh", "warm"], shot: ["medium", "eye-level", "over-shoulder"], lighting: ["window", "high-key", "overcast"], ratio: ["16:9", "4:3", "1:1"] },
  },
  {
    id: "finance", zh: "金融保險", en: "Finance & insurance",
    prompt: "for a finance and insurance brand, secure, stable and forward-looking", promptZh: "金融保險品牌用圖，安全穩健且具前瞻性",
    keywords: ["金融", "銀行", "bank", "finance", "保險", "insurance", "投資", "invest", "理財", "fintech", "證券", "支付", "payment"],
    subjects: [{ en: "a family planning their future together at home", zh: "在家一起規劃未來的家庭" }, { en: "abstract rising lines of light suggesting growth", zh: "象徵成長的抽象上升光線" }],
    recommends: { palette: ["tech-blue", "forest-green", "monochrome"], style: ["minimal", "lifestyle", "tech-abstract"], mood: ["trustworthy", "calm", "futuristic"], shot: ["negative-space", "eye-level", "wide"], lighting: ["window", "softbox", "blue-hour"], ratio: ["16:9", "3:2", "4:3"] },
  },
  {
    id: "fitness", zh: "運動健身", en: "Sports & fitness",
    prompt: "for a sports and fitness brand, powerful and full of motion", promptZh: "運動健身品牌用圖，充滿力量與動態",
    keywords: ["運動", "健身", "fitness", "gym", "sport", "瑜珈", "yoga", "跑步", "running", "球", "訓練", "training", "戶外", "outdoor"],
    subjects: [{ en: "an athlete mid-sprint with dust and sweat in the air", zh: "衝刺中揚起塵土與汗水的運動員" }, { en: "a calm yoga pose at sunrise", zh: "日出時寧靜的瑜珈動作" }],
    recommends: { palette: ["vivid-pop", "monochrome", "sunset"], style: ["cinematic", "documentary", "editorial"], mood: ["energetic", "bold", "fresh"], shot: ["low-angle", "close-up", "wide"], lighting: ["rim", "golden-hour", "low-key"], ratio: ["16:9", "9:16", "4:5"] },
  },
  {
    id: "nonprofit", zh: "公益組織", en: "Non-profit",
    prompt: "for a non-profit organisation, hopeful, human and sincere", promptZh: "公益組織用圖，充滿希望、真誠且有人味",
    keywords: ["公益", "非營利", "nonprofit", "ngo", "基金會", "foundation", "志工", "volunteer", "社會", "環保", "永續", "sustainability", "捐款"],
    subjects: [{ en: "volunteers working side by side in a community garden", zh: "在社區菜園並肩工作的志工" }, { en: "a child's hands holding a young seedling", zh: "孩子雙手捧著幼苗" }],
    recommends: { palette: ["forest-green", "warm-earth", "mint-fresh"], style: ["documentary", "lifestyle", "watercolor"], mood: ["warm", "calm", "fresh"], shot: ["medium", "close-up", "eye-level"], lighting: ["golden-hour", "overcast", "window"], ratio: ["16:9", "3:2", "1:1"] },
  },
  {
    id: "events", zh: "活動展演", en: "Events & entertainment",
    prompt: "for an event or entertainment brand, electric and immersive", promptZh: "活動展演用圖，熱烈且身歷其境",
    keywords: ["活動", "event", "展覽", "exhibition", "演唱會", "concert", "音樂", "music", "祭", "festival", "研討會", "conference", "派對", "party", "劇場", "theatre"],
    subjects: [{ en: "a crowd under stage lights at a live show", zh: "現場演出舞台燈光下的人群" }, { en: "an immersive exhibition hall with light installations", zh: "有光影裝置的沉浸式展場" }],
    recommends: { palette: ["neon-cyber", "vivid-pop", "sunset"], style: ["cinematic", "documentary", "tech-abstract"], mood: ["energetic", "bold", "mysterious"], shot: ["wide", "low-angle", "over-shoulder"], lighting: ["neon", "low-key", "rim"], ratio: ["16:9", "9:16", "1:1"] },
  },
];

// --- lookups ------------------------------------------------------------------------

/** Each group's options, keyed by group, for code that treats groups uniformly. */
export const OPTION_GROUPS: Record<OptionGroup, PromptOption[]> = {
  industry: INDUSTRIES,
  palette: PALETTES,
  style: STYLES,
  mood: MOODS,
  shot: SHOTS,
  lighting: LIGHTING,
  ratio: RATIOS,
};

export const GROUP_ORDER: OptionGroup[] = ["industry", "palette", "style", "mood", "shot", "lighting", "ratio"];

export const GROUP_LABELS: Record<OptionGroup, { zh: string; en: string }> = {
  industry: { zh: "產業", en: "Industry" },
  palette: { zh: "色系", en: "Palette" },
  style: { zh: "風格", en: "Style" },
  mood: { zh: "調性", en: "Mood" },
  shot: { zh: "鏡位", en: "Shot" },
  lighting: { zh: "光線", en: "Lighting" },
  ratio: { zh: "比例", en: "Aspect ratio" },
};

export function findOption<G extends OptionGroup>(group: G, id: string | undefined): PromptOption | undefined {
  if (!id) return undefined;
  return OPTION_GROUPS[group].find((option) => option.id === id);
}

export const getIndustry = (id?: string) => INDUSTRIES.find((option) => option.id === id);
export const getStyle = (id?: string) => STYLES.find((option) => option.id === id);
export const getPalette = (id?: string) => PALETTES.find((option) => option.id === id);
export const getShot = (id?: string) => SHOTS.find((option) => option.id === id);
export const getRatio = (id?: string) => RATIOS.find((option) => option.id === id);

/**
 * Guess the industry from a typed keyword by counting keyword hits. Longer
 * hits count for more, so "咖啡廳" beats a stray single character elsewhere.
 */
export function inferIndustry(keyword: string): string | undefined {
  const text = keyword.trim().toLowerCase();
  if (!text) return undefined;

  let best: { id: string; score: number } | undefined;
  for (const industry of INDUSTRIES) {
    let score = 0;
    for (const word of industry.keywords) {
      const needle = word.toLowerCase();
      // Short Latin words ("ai", "ev", "bar") must match a whole word, or
      // "bar" would match "barista" and "ai" would match "chair".
      const hit = /^[a-z]{1,3}$/.test(needle)
        ? new RegExp(`(^|[^a-z])${needle}([^a-z]|$)`).test(text)
        : text.includes(needle);
      if (hit) score += needle.length;
    }
    if (score > 0 && (!best || score > best.score)) best = { id: industry.id, score };
  }
  return best?.id;
}
