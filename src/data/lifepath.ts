// "Your Life Before" — an original life-path in Kalashscovia, in the spirit of the backstory tables
// players love. Every result is canon for your character, and NPCs can react to it.
export interface LifeEntry { id: string; text: string; item?: string; flag?: string }
export interface LifeTable { id: string; label: string; entries: LifeEntry[] }

export const LIFE: LifeTable[] = [
  { id: 'born', label: 'Where you were born', entries: [
    { id: 'breda', text: 'In Breda, two streets from the Smoking Barrel. Squib knew your family.', flag: 'local' },
    { id: 'hamlet', text: 'In a Lahti hamlet that isn\'t on the maps any more.' },
    { id: 'suomi', text: 'In Suomi, under the white spires.' },
    { id: 'makrovin', text: 'In Makrovin, across the treaty line. Lahti still notices your accent.', flag: 'makrovin' },
    { id: 'docks', text: 'On a barge on the Aimo, between Largo and Borschardt.' },
    { id: 'mire', text: 'At the edge of the Southern Mire, among the stilt-houses of Shpagin.' },
    { id: 'camp', text: 'In a war camp. Nobody wrote down which side.' },
    { id: 'overseas', text: 'Across the Northern Ocean. You came in through Madsen with nothing.' },
  ] },
  { id: 'family', label: 'Your family in the war', entries: [
    { id: 'lahti', text: 'They fought for Lahti, and came home quieter than they left.' },
    { id: 'makrovin', text: 'They fought for Makrovin. You learned not to say so in elf towns.' },
    { id: 'healers', text: 'They were healers who patched up both sides and asked no questions.' },
    { id: 'deserters', text: 'They deserted. You have never decided whether you\'re ashamed or proud.' },
    { id: 'profiteers', text: 'They got rich selling cartridges to both armies.', flag: 'rich' },
    { id: 'greymarch', text: 'Someone of yours died at Greymarch Field. You\'ve never visited the grave.', flag: 'greymarch' },
    { id: 'farmers', text: 'They were farmers who kept their heads down and their doors shut.' },
    { id: 'unknown', text: 'You don\'t know. Nobody would tell you.' },
  ] },
  { id: 'raised', label: 'Who raised you', entries: [
    { id: 'parents', text: 'Both parents, more or less.' },
    { id: 'one', text: 'One parent, who worked too hard and laughed too little.' },
    { id: 'grandparents', text: 'Grandparents, who told you stories about a queen nobody else remembers.', flag: 'queen_story' },
    { id: 'orphanage', text: 'The crown orphanage at Coltale, with two hundred other children of the war.' },
    { id: 'troupe', text: 'A travelling theatre troupe. You can still do six accents.' },
    { id: 'temple', text: 'The priests of an empty chapel, until the chapel closed.' },
    { id: 'streets', text: 'Nobody. The streets of Largo did a passable job.' },
    { id: 'mentor', text: 'An old veteran who taught you everything except why he drank.' },
  ] },
  { id: 'event', label: 'Something that happened to you', entries: [
    { id: 'saw_dead', text: 'As a child, you saw a dead man get up and walk into the Thornwood. Nobody believed you.', flag: 'saw_dead' },
    { id: 'debt', text: 'You owe money to a Borschardt counting-house. They write letters.', flag: 'debt' },
    { id: 'radom', text: 'You spent a month in the cells at Radom for something you didn\'t do. Mostly didn\'t do.' },
    { id: 'peaks', text: 'You survived a winter alone in the Northern Peaks.' },
    { id: 'coin', text: 'You found an old coin stamped with a crowned woman\'s face. Nobody can tell you who she is.', item: 'queens_coin', flag: 'queens_coin' },
    { id: 'bell', text: 'You once heard a bell ring at midnight, far away. The next day your village buried three people.', flag: 'heard_bell' },
    { id: 'love', text: 'You fell in love with someone in Largo. You left without saying goodbye.' },
    { id: 'saved', text: 'A stranger with white hair saved your life and wouldn\'t give a name.' },
    { id: 'treaty', text: 'You were in the crowd at the Treaty Stone the day the peace was signed.', flag: 'treaty' },
    { id: 'lottery', text: 'You won a Galilin card game against a dragonborn mercenary. He still wants a rematch.' },
  ] },
];
