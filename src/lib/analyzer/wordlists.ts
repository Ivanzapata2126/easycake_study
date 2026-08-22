// Listas lexicas que alimentan el analizador heuristico.
// La idea: sin IA, la calidad de los huecos depende enteramente de estas listas.
// Cada una responde a una pregunta distinta: "esto es demasiado facil?" (COMMON),
// "esto es dificil de verdad?" (CONNECTORS / IRREGULAR / COLLOCATIONS).

/** Palabras funcionales. Nunca son hueco por si solas: taparlas no ensena nada. */
export const STOPWORDS = new Set<string>([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'so', 'of', 'to', 'in', 'on', 'at',
  'by', 'for', 'with', 'from', 'as', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
  'being', 'do', 'does', 'did', 'have', 'has', 'had', 'i', 'you', 'he', 'she', 'it',
  'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'its', 'our',
  'their', 'this', 'that', 'these', 'those', 'there', 'here', 'what', 'who', 'whom',
  'which', 'when', 'where', 'why', 'how', 'not', 'no', 'yes', 'all', 'any', 'some',
  'up', 'out', 'off', 'over', 'down', 'about', 'into', 'than', 'then', 'too', 'very',
  'just', 'now', 'also', 'only', 'own', 'same', 'more', 'most', 'other', 'such',
  'one', 'two', 'ok', 'okay', 'oh', 'well', 'hi', 'hey', 'hello', 'bye', 'please',
  'thanks', 'thank', 'sure', 'yeah', 'yep', 'nope', 'mr', 'mrs', 'ms', 'dr',
]);

/**
 * Tier 1: las ~350 palabras mas frecuentes del ingles. Contenido, pero demasiado
 * comun para que taparlas ensene algo. Se descartan como candidato `vocab`.
 */
export const COMMON_TIER1 = new Set<string>([
  'time', 'people', 'way', 'day', 'man', 'thing', 'woman', 'life', 'child', 'world',
  'school', 'state', 'family', 'student', 'group', 'country', 'problem', 'hand',
  'part', 'place', 'case', 'week', 'company', 'system', 'program', 'question',
  'work', 'government', 'number', 'night', 'point', 'home', 'water', 'room',
  'mother', 'area', 'money', 'story', 'fact', 'month', 'lot', 'right', 'study',
  'book', 'eye', 'job', 'word', 'business', 'issue', 'side', 'kind', 'head',
  'house', 'service', 'friend', 'father', 'power', 'hour', 'game', 'line', 'end',
  'member', 'law', 'car', 'city', 'name', 'team', 'minute', 'idea', 'kid', 'body',
  'back', 'parent', 'face', 'level', 'office', 'door', 'health', 'person', 'art',
  'war', 'history', 'party', 'result', 'change', 'morning', 'reason', 'research',
  'girl', 'guy', 'moment', 'air', 'teacher', 'force', 'education', 'foot', 'boy',
  'age', 'policy', 'process', 'music', 'market', 'sense', 'nation', 'plan', 'college',
  'interest', 'death', 'course', 'someone', 'experience', 'behind', 'reach', 'local',
  'kill', 'six', 'remain', 'effect', 'use', 'yeah', 'suggest', 'class', 'control',
  'raise', 'care', 'perhaps', 'little', 'late', 'hard', 'field', 'else', 'pass',
  'former', 'sell', 'major', 'sometimes', 'require', 'along', 'development',
  'themselves', 'report', 'role', 'better', 'economic', 'effort', 'decide', 'rate',
  'strong', 'possible', 'heart', 'drug', 'show', 'leader', 'light', 'voice', 'wife',
  'whole', 'police', 'mind', 'finally', 'pull', 'return', 'free', 'military', 'price',
  'less', 'according', 'decision', 'explain', 'son', 'hope', 'even', 'develop',
  'view', 'relationship', 'carry', 'town', 'road', 'drive', 'arm', 'true', 'federal',
  'break', 'though', 'whether', 'improve', 'medical', 'president', 'situation',
  'get', 'go', 'make', 'know', 'take', 'see', 'come', 'think', 'look', 'want',
  'give', 'find', 'tell', 'ask', 'seem', 'feel', 'try', 'leave', 'call', 'good',
  'new', 'first', 'last', 'long', 'great', 'own', 'old', 'big', 'high', 'small',
  'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad', 'able',
  'need', 'become', 'mean', 'keep', 'let', 'begin', 'help', 'talk', 'turn', 'start',
  'might', 'move', 'like', 'live', 'believe', 'hold', 'bring', 'happen', 'write',
  'provide', 'sit', 'stand', 'lose', 'add', 'play', 'run', 'watch', 'follow', 'stop',
  'create', 'speak', 'read', 'spend', 'grow', 'open', 'walk', 'win', 'teach', 'offer',
  'remember', 'love', 'consider', 'appear', 'buy', 'wait', 'serve', 'send', 'expect',
  'build', 'stay', 'fall', 'cut', 'reach', 'remain', 'pay', 'meet', 'include',
  'continue', 'set', 'learn', 'lead', 'understand', 'put', 'today', 'tomorrow',
  'yesterday', 'always', 'never', 'often', 'again', 'still', 'really', 'much',
  'many', 'every', 'each', 'both', 'because', 'while', 'before', 'after', 'during',
  'between', 'through', 'against', 'without', 'around', 'under', 'until', 'since',
  'nice', 'happy', 'sorry', 'fine', 'sound', 'maybe', 'thing', 'stuff', 'guess',
]);

/**
 * Tier 2: comunes pero ya con carga semantica. Sirven de hueco facil (dificultad 2).
 */
export const COMMON_TIER2 = new Set<string>([
  'answer', 'apply', 'accept', 'address', 'agree', 'allow', 'almost', 'already',
  'amount', 'announce', 'anyone', 'anything', 'approach', 'argue', 'arrive',
  'article', 'attack', 'attend', 'attention', 'available', 'avoid', 'away',
  'baby', 'balance', 'bank', 'base', 'beautiful', 'bed', 'behavior', 'benefit',
  'best', 'beyond', 'bill', 'bit', 'blood', 'board', 'boat', 'born', 'box', 'brain',
  'brother', 'budget', 'building', 'camera', 'campaign', 'cancer', 'capital',
  'career', 'cause', 'cell', 'center', 'central', 'century', 'certain', 'chance',
  'character', 'charge', 'check', 'choice', 'choose', 'church', 'citizen', 'claim',
  'clear', 'close', 'coach', 'cold', 'collection', 'color', 'common', 'community',
  'compare', 'computer', 'concern', 'condition', 'conference', 'congress', 'contain',
  'contract', 'cost', 'could', 'couple', 'court', 'cover', 'cultural', 'culture',
  'current', 'customer', 'cup', 'dark', 'data', 'daughter', 'deal', 'debate', 'decade',
  'deep', 'defense', 'degree', 'democratic', 'department', 'describe', 'design',
  'despite', 'detail', 'determine', 'difference', 'different', 'difficult', 'dinner',
  'direction', 'director', 'discover', 'discuss', 'disease', 'doctor', 'dog', 'door',
  'draw', 'dream', 'drop', 'eat', 'economy', 'edge', 'effective', 'eight', 'either',
  'election', 'employee', 'energy', 'enjoy', 'enough', 'enter', 'entire', 'environment',
  'especially', 'establish', 'evening', 'event', 'everybody', 'everyone', 'everything',
  'evidence', 'exactly', 'example', 'executive', 'exist', 'expert', 'explain',
  'eye', 'factor', 'fail', 'fast', 'fear', 'feeling', 'fight', 'figure', 'fill',
  'film', 'final', 'financial', 'fire', 'firm', 'fish', 'five', 'floor', 'fly',
  'focus', 'food', 'football', 'foreign', 'forget', 'form', 'forward', 'four',
  'front', 'full', 'fund', 'future', 'garden', 'gas', 'general', 'generation',
  'glass', 'goal', 'green', 'ground', 'growth', 'gun', 'guy', 'hair', 'half',
  'hang', 'happen', 'hate', 'heat', 'heavy', 'herself', 'himself', 'hospital',
  'hot', 'hotel', 'huge', 'human', 'hundred', 'husband', 'identify', 'image',
  'imagine', 'impact', 'increase', 'indeed', 'indicate', 'individual', 'industry',
  'information', 'inside', 'instead', 'institution', 'international', 'interview',
  'investment', 'involve', 'itself', 'join', 'kitchen', 'knowledge', 'land',
  'language', 'later', 'laugh', 'lawyer', 'least', 'left', 'leg', 'legal', 'letter',
  'lie', 'listen', 'loss', 'low', 'machine', 'magazine', 'main', 'maintain',
  'manage', 'manager', 'marriage', 'material', 'matter', 'may', 'measure', 'media',
  'medicine', 'meeting', 'memory', 'mention', 'message', 'method', 'middle',
  'million', 'mission', 'model', 'modern', 'moment', 'month', 'morning', 'movement',
  'movie', 'myself', 'nature', 'nearly', 'necessary', 'network', 'news', 'newspaper',
  'nine', 'north', 'note', 'nothing', 'notice', 'nuclear', 'occur', 'ocean', 'officer',
  'official', 'oil', 'once', 'operation', 'opportunity', 'option', 'order',
  'organization', 'others', 'outside', 'page', 'pain', 'painting', 'paper', 'partner',
  'past', 'patient', 'pattern', 'peace', 'per', 'perform', 'performance', 'period',
  'personal', 'phone', 'physical', 'pick', 'picture', 'piece', 'plant', 'player',
  'political', 'poor', 'popular', 'population', 'position', 'positive', 'possibility',
  'practice', 'prepare', 'present', 'pressure', 'pretty', 'prevent', 'private',
  'probably', 'produce', 'product', 'production', 'professional', 'professor',
  'project', 'property', 'protect', 'prove', 'purpose', 'push', 'quality', 'question',
  'quickly', 'quite', 'race', 'radio', 'range', 'rather', 'reality', 'realize',
  'reason', 'receive', 'recent', 'recently', 'recognize', 'record', 'reduce',
  'reflect', 'region', 'relate', 'religious', 'remove', 'reply', 'represent',
  'republican', 'respond', 'response', 'responsibility', 'rest', 'restaurant',
  'result', 'reveal', 'rich', 'rise', 'risk', 'river', 'rock', 'rule', 'safe',
  'save', 'scene', 'science', 'scientist', 'score', 'sea', 'season', 'seat',
  'second', 'section', 'security', 'seek', 'sell', 'senior', 'series', 'serious',
  'seven', 'several', 'sex', 'shake', 'share', 'shoot', 'short', 'shot', 'should',
  'shoulder', 'shut', 'sign', 'significant', 'similar', 'simple', 'simply', 'sing',
  'single', 'sister', 'site', 'size', 'skill', 'skin', 'sleep', 'smile', 'social',
  'society', 'soldier', 'solution', 'somebody', 'something', 'sometimes', 'son',
  'song', 'soon', 'sort', 'source', 'south', 'space', 'special', 'specific',
  'speech', 'sport', 'spring', 'staff', 'stage', 'standard', 'star', 'statement',
  'station', 'step', 'stock', 'store', 'street', 'strategy', 'strike', 'structure',
  'style', 'subject', 'success', 'successful', 'suddenly', 'suffer', 'summer',
  'support', 'surface', 'system', 'table', 'talk', 'task', 'tax', 'technology',
  'television', 'ten', 'tend', 'term', 'test', 'thank', 'theory', 'third',
  'thousand', 'threat', 'three', 'throw', 'thus', 'together', 'tonight', 'top',
  'total', 'tough', 'toward', 'trade', 'traditional', 'training', 'travel', 'treat',
  'treatment', 'tree', 'trial', 'trip', 'trouble', 'truth', 'type', 'unit',
  'university', 'unless', 'usually', 'value', 'various', 'victim', 'video', 'visit',
  'voter', 'wall', 'weapon', 'wear', 'weather', 'weight', 'west', 'western',
  'white', 'whose', 'wide', 'wife', 'wind', 'window', 'wish', 'within', 'without',
  'wonder', 'worker', 'worry', 'worth', 'writer', 'wrong', 'yard', 'year', 'young',
]);

/**
 * Conectores y marcadores del discurso. Los que mas se piden en un fill-in-the-blank
 * de examen y los que mas cuesta acertar: siempre dificultad alta.
 */
export const CONNECTORS = new Set<string>([
  'however', 'therefore', 'moreover', 'nevertheless', 'nonetheless', 'furthermore',
  'although', 'though', 'whereas', 'meanwhile', 'besides', 'otherwise', 'thus',
  'hence', 'consequently', 'accordingly', 'indeed', 'instead', 'anyway', 'anyhow',
  'regardless', 'whenever', 'wherever', 'whatever', 'whoever', 'unless', 'despite',
  'notwithstanding', 'likewise', 'similarly', 'conversely', 'alternatively',
  'subsequently', 'previously', 'ultimately', 'eventually', 'basically', 'actually',
  'apparently', 'obviously', 'clearly', 'certainly', 'definitely', 'absolutely',
  'hopefully', 'frankly', 'honestly', 'seriously', 'admittedly', 'arguably',
  'presumably', 'supposedly', 'evidently', 'undoubtedly', 'surprisingly',
  'unfortunately', 'fortunately', 'interestingly', 'importantly', 'specifically',
  'particularly', 'generally', 'typically', 'normally', 'occasionally', 'frequently',
  'rarely', 'seldom', 'hardly', 'barely', 'scarcely', 'merely', 'namely',
]);

/**
 * Formas irregulares (pasado / participio). Se tapan porque el estudiante tiende a
 * regularizarlas ("thinked", "buyed") y ese es exactamente el error que hay que cazar.
 */
export const IRREGULAR_FORMS = new Set<string>([
  'was', 'were', 'been', 'had', 'did', 'done', 'went', 'gone', 'came', 'become',
  'became', 'brought', 'bought', 'built', 'caught', 'chose', 'chosen', 'cost',
  'cut', 'dealt', 'drew', 'drawn', 'drank', 'drunk', 'drove', 'driven', 'ate',
  'eaten', 'fell', 'fallen', 'felt', 'fought', 'found', 'flew', 'flown', 'forgot',
  'forgotten', 'forgave', 'forgiven', 'froze', 'frozen', 'got', 'gotten', 'gave',
  'given', 'grew', 'grown', 'heard', 'hid', 'hidden', 'hit', 'held', 'hurt', 'kept',
  'knew', 'known', 'laid', 'led', 'left', 'lent', 'let', 'lay', 'lain', 'lost',
  'made', 'meant', 'met', 'paid', 'put', 'read', 'rode', 'ridden', 'rang', 'rung',
  'rose', 'risen', 'ran', 'run', 'said', 'saw', 'seen', 'sold', 'sent', 'set',
  'shook', 'shaken', 'shone', 'shot', 'showed', 'shown', 'shut', 'sang', 'sung',
  'sank', 'sunk', 'sat', 'slept', 'spoke', 'spoken', 'spent', 'stood', 'stole',
  'stolen', 'stuck', 'struck', 'swam', 'swum', 'took', 'taken', 'taught', 'tore',
  'torn', 'told', 'thought', 'threw', 'thrown', 'understood', 'woke', 'woken',
  'wore', 'worn', 'won', 'wrote', 'written',
]);

/** Modales y semi-modales: nucleo de la gramatica de examen. */
export const MODALS = new Set<string>([
  'would', 'should', 'could', 'might', 'must', 'shall', 'ought', 'may', 'can',
  'will', 'need', 'dare', 'used',
]);

/**
 * Colocaciones verbo/adjetivo + preposicion dependiente. Se tapa SOLO la preposicion:
 * es el error clasico del hispanohablante ("depend of", "interested on").
 * clave = palabra que dispara, valor = preposicion(es) correcta(s).
 */
export const DEPENDENT_PREPOSITIONS: Record<string, string[]> = {
  interested: ['in'], depend: ['on'], depends: ['on'], depending: ['on'],
  good: ['at'], bad: ['at'], great: ['at'], terrible: ['at'],
  afraid: ['of'], scared: ['of'], tired: ['of'], proud: ['of'], full: ['of'],
  aware: ['of'], capable: ['of'], ashamed: ['of'], jealous: ['of'],
  married: ['to'], similar: ['to'], used: ['to'], listen: ['to'], listening: ['to'],
  belong: ['to'], according: ['to'], due: ['to'], thanks: ['to'],
  worried: ['about'], excited: ['about'], think: ['about'], care: ['about'],
  complain: ['about'], talk: ['about'], talking: ['about'],
  responsible: ['for'], famous: ['for'], ready: ['for'], sorry: ['for'],
  wait: ['for'], waiting: ['for'], look: ['for'], apologize: ['for'],
  angry: ['at', 'with'], agree: ['with'], deal: ['with'], cope: ['with'],
  satisfied: ['with'], busy: ['with'], familiar: ['with'],
  succeed: ['in'], believe: ['in'], involved: ['in'], participate: ['in'],
  specialize: ['in'], result: ['in'], invest: ['in'],
  rely: ['on'], concentrate: ['on'], insist: ['on'], focus: ['on'], based: ['on'],
  congratulate: ['on'], comment: ['on'],
  consist: ['of'], accuse: ['of'], remind: ['of'], approve: ['of'], dream: ['of'],
  suffer: ['from'], prevent: ['from'], protect: ['from'], different: ['from'],
  borrow: ['from'], escape: ['from'], benefit: ['from'],
};

/** Contracciones -> forma expandida. Alimenta tanto candidatos como la correccion. */
export const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am', "i've": 'i have', "i'll": 'i will', "i'd": 'i would',
  "you're": 'you are', "you've": 'you have', "you'll": 'you will', "you'd": 'you would',
  "he's": 'he is', "he'll": 'he will', "he'd": 'he would',
  "she's": 'she is', "she'll": 'she will', "she'd": 'she would',
  "it's": 'it is', "it'll": 'it will', "it'd": 'it would',
  "we're": 'we are', "we've": 'we have', "we'll": 'we will', "we'd": 'we would',
  "they're": 'they are', "they've": 'they have', "they'll": 'they will',
  "they'd": 'they would', "that's": 'that is', "there's": 'there is',
  "who's": 'who is', "what's": 'what is', "where's": 'where is', "let's": 'let us',
  "isn't": 'is not', "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not',
  "don't": 'do not', "doesn't": 'does not', "didn't": 'did not',
  "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not',
  "won't": 'will not', "wouldn't": 'would not', "can't": 'cannot',
  "couldn't": 'could not', "shouldn't": 'should not', "mustn't": 'must not',
  "mightn't": 'might not', "needn't": 'need not', "cannot": 'can not',
};

/** Pool de reserva para generar distractores cuando el script no da suficientes. */
export const DISTRACTOR_POOL: Record<string, string[]> = {
  preposition: ['in', 'on', 'at', 'for', 'to', 'with', 'about', 'of', 'from', 'by'],
  connector: ['however', 'although', 'therefore', 'meanwhile', 'besides', 'instead',
    'whereas', 'otherwise', 'moreover', 'nevertheless'],
  modal: ['would', 'should', 'could', 'might', 'must', 'can', 'will', 'may'],
  verb_form: ['went', 'made', 'took', 'brought', 'thought', 'kept', 'found', 'told'],
  contraction: ["i'm", "it's", "don't", "won't", "that's", "we're", "they've"],
};
