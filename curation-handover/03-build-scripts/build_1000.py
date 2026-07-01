# -*- coding: utf-8 -*-
"""
FilmCurio +1,000 expansion (Wave 2).
Demand x Density scoring model. Deduped vs existing 567 + delivered 405.
Each pool sets (bucket, D, Q) defaults; per-film 6-tuple overrides D,Q.
priority = D*Q + recency_bonus + graph_bonus(hub director)
Buckets target: Canon 40% / Contemporary 33% / Popular 27%.
"""
import csv, re, unicodedata, math
from collections import Counter, defaultdict

OUTDIR="/sessions/confident-intelligent-newton/mnt/outputs"

def norm(t):
    t=unicodedata.normalize("NFKD",t).encode("ascii","ignore").decode("ascii").lower()
    t=re.sub(r"\b(the|a|an)\b"," ",t)
    t=re.sub(r"[^a-z0-9]+"," ",t)
    return t.strip()

# ---- exclusion set: existing 567 + delivered 405
excl=set()
with open(f"{OUTDIR}/existing_567_titles.txt",encoding="utf-8") as f:
    for ln in f:
        if ln.strip(): excl.add(norm(ln))
with open(f"{OUTDIR}/metatake_films_expansion_405.csv",encoding="utf-8") as f:
    for row in csv.DictReader(f):
        if row["Film_Title"].strip(): excl.add(norm(row["Film_Title"]))

# hub directors already forming catalogue meta-takes (graph bonus)
HUBS={ "Martin Scorsese","Steven Spielberg","Christopher Nolan","David Fincher","Joel Coen","Ethan Coen",
 "Quentin Tarantino","Paul Thomas Anderson","Denis Villeneuve","David Lynch","David Cronenberg","Michael Haneke",
 "Pedro Almodovar","Hirokazu Kore-eda","Hong Sang-soo","Park Chan-wook","Bong Joon Ho","Lee Chang-dong",
 "Ryusuke Hamaguchi","Nuri Bilge Ceylan","Asghar Farhadi","Jean-Pierre Dardenne","Luc Dardenne","Jacques Audiard",
 "Yorgos Lanthimos","Darren Aronofsky","Wes Anderson","Nicolas Winding Refn","Lars von Trier","Ruben Ostlund",
 "Aki Kaurismaki","Joachim Trier","Claire Denis","Francois Ozon","Celine Sciamma","Kelly Reichardt","Jim Jarmusch",
 "Richard Linklater","Noah Baumbach","Todd Haynes","Gus Van Sant","Sofia Coppola","Spike Lee","Damien Chazelle",
 "Sean Baker","Barry Jenkins","Chloe Zhao","Robert Eggers","Jordan Peele","Ari Aster","Hayao Miyazaki","Isao Takahata",
 "Satoshi Kon","Makoto Shinkai","Akira Kurosawa","Yasujiro Ozu","Ingmar Bergman","Federico Fellini",
 "Michelangelo Antonioni","Jean-Luc Godard","Francois Truffaut","Robert Bresson","Andrei Tarkovsky","Alfred Hitchcock",
 "Stanley Kubrick","Wong Kar-wai","Hou Hsiao-hsien","Zhang Yimou","Jia Zhangke","Werner Herzog",
 "Rainer Werner Fassbinder","Krzysztof Kieslowski","Luis Bunuel","Wim Wenders","Terrence Malick","Abbas Kiarostami",
 "Pablo Larrain","Mati Diop","Kaouther Ben Hania","Kelly Reichardt","Ali Abbasi","Steven Soderbergh","Edgar Wright",
 "Guillermo del Toro","Alfonso Cuaron","Alejandro Gonzalez Inarritu","Kim Jee-woon","John Woo" }

rows=[]   # (T,Dir,Year,Country,bucket,D,Q)
def pool(bucket,D,Q,items):
    for it in items:
        if len(it)==4: t,d,y,c=it; dd,qq=D,Q
        else: t,d,y,c,dd,qq=it
        rows.append((t,d,int(y),c,bucket,dd,qq))

CANON="Canon backfill"; CONTEMP="Contemporary curation"; POP="Popular/genre depth"

# ============ CANON ============
# --- Hitchcock remaining
pool(CANON,3,5,[
 ("Rope","Alfred Hitchcock",1948,"USA"),("Strangers on a Train","Alfred Hitchcock",1951,"USA"),
 ("Shadow of a Doubt","Alfred Hitchcock",1943,"USA"),("Rebecca","Alfred Hitchcock",1940,"USA"),
 ("Dial M for Murder","Alfred Hitchcock",1954,"USA"),("The Birds","Alfred Hitchcock",1963,"USA",4,5),
 ("Notorious","Alfred Hitchcock",1946,"USA"),("The 39 Steps","Alfred Hitchcock",1935,"UK"),
 ("The Lady Vanishes","Alfred Hitchcock",1938,"UK"),("Suspicion","Alfred Hitchcock",1941,"USA"),
 ("Spellbound","Alfred Hitchcock",1945,"USA"),("The Man Who Knew Too Much","Alfred Hitchcock",1956,"USA"),
 ("To Catch a Thief","Alfred Hitchcock",1955,"USA"),("Marnie","Alfred Hitchcock",1964,"USA"),
 ("Frenzy","Alfred Hitchcock",1972,"UK"),("Sabotage","Alfred Hitchcock",1936,"UK"),
 ("Lifeboat","Alfred Hitchcock",1944,"USA"),("Foreign Correspondent","Alfred Hitchcock",1940,"USA"),
])
# --- Kubrick / Bergman / Kurosawa / Ozu / Fellini / Antonioni remaining
pool(CANON,3,5,[
 ("The Killing","Stanley Kubrick",1956,"USA"),("Spartacus","Stanley Kubrick",1960,"USA",4,4),
 ("The Virgin Spring","Ingmar Bergman",1960,"Sweden"),("Shame","Ingmar Bergman",1968,"Sweden"),
 ("Hour of the Wolf","Ingmar Bergman",1968,"Sweden"),("Autumn Sonata","Ingmar Bergman",1978,"Sweden"),
 ("Summer with Monika","Ingmar Bergman",1953,"Sweden"),("The Magician","Ingmar Bergman",1958,"Sweden"),
 ("Drunken Angel","Akira Kurosawa",1948,"Japan"),("Stray Dog","Akira Kurosawa",1949,"Japan"),
 ("Red Beard","Akira Kurosawa",1965,"Japan"),("The Bad Sleep Well","Akira Kurosawa",1960,"Japan"),
 ("Sanjuro","Akira Kurosawa",1962,"Japan"),("Dersu Uzala","Akira Kurosawa",1975,"USSR/Japan"),
 ("Kagemusha","Akira Kurosawa",1980,"Japan"),("Dreams","Akira Kurosawa",1990,"Japan"),
 ("I Was Born, But...","Yasujiro Ozu",1932,"Japan"),("Good Morning","Yasujiro Ozu",1959,"Japan"),
 ("Early Summer","Yasujiro Ozu",1951,"Japan"),("Equinox Flower","Yasujiro Ozu",1958,"Japan"),
 ("Tokyo Twilight","Yasujiro Ozu",1957,"Japan"),("There Was a Father","Yasujiro Ozu",1942,"Japan"),
 ("I Vitelloni","Federico Fellini",1953,"Italy"),("Amarcord","Federico Fellini",1973,"Italy",3,5),
 ("Roma","Federico Fellini",1972,"Italy"),("Juliet of the Spirits","Federico Fellini",1965,"Italy"),
 ("Satyricon","Federico Fellini",1969,"Italy"),("La Notte","Michelangelo Antonioni",1961,"Italy"),
 ("The Passenger","Michelangelo Antonioni",1975,"Italy"),("Zabriskie Point","Michelangelo Antonioni",1970,"USA"),
 ("Il Grido","Michelangelo Antonioni",1957,"Italy"),
])
# --- French canon (New Wave + classics) remaining
pool(CANON,3,5,[
 ("Jeanne Dielman, 23 quai du Commerce","Chantal Akerman",1975,"Belgium",3,5),
 ("News from Home","Chantal Akerman",1977,"Belgium",2,5),
 ("Pierrot le Fou","Jean-Luc Godard",1965,"France"),  # safety; may dup-keep
 ("Alphaville","Jean-Luc Godard",1965,"France"),("Vivre sa vie","Jean-Luc Godard",1962,"France"),
 ("Masculin Feminin","Jean-Luc Godard",1966,"France"),("Weekend","Jean-Luc Godard",1967,"France"),
 ("Une Femme est une Femme","Jean-Luc Godard",1961,"France"),("La Chinoise","Jean-Luc Godard",1967,"France"),
 ("Shoot the Piano Player","Francois Truffaut",1960,"France"),("Day for Night","Francois Truffaut",1973,"France"),
 ("The Wild Child","Francois Truffaut",1970,"France"),("The Last Metro","Francois Truffaut",1980,"France"),
 ("Stolen Kisses","Francois Truffaut",1968,"France"),("The Story of Adele H.","Francois Truffaut",1975,"France"),
 ("Diary of a Country Priest","Robert Bresson",1951,"France"),("A Man Escaped","Robert Bresson",1956,"France"),
 ("Mouchette","Robert Bresson",1967,"France"),("L'Argent","Robert Bresson",1983,"France"),
 ("Lancelot du Lac","Robert Bresson",1974,"France"),
 ("My Night at Maud's","Eric Rohmer",1969,"France"),("Claire's Knee","Eric Rohmer",1970,"France"),
 ("Pauline at the Beach","Eric Rohmer",1983,"France"),("The Green Ray","Eric Rohmer",1986,"France"),
 ("Celine and Julie Go Boating","Jacques Rivette",1974,"France"),("La Belle Noiseuse","Jacques Rivette",1991,"France"),
 ("Le Boucher","Claude Chabrol",1970,"France"),("La Ceremonie","Claude Chabrol",1995,"France"),
 ("The Mother and the Whore","Jean Eustache",1973,"France"),("A nos amours","Maurice Pialat",1983,"France"),
 ("Le Samourai","Jean-Pierre Melville",1967,"France"),  # keep-distinct handled below
 ("Le Doulos","Jean-Pierre Melville",1962,"France"),("Leon Morin, Priest","Jean-Pierre Melville",1961,"France"),
 ("Mr. Hulot's Holiday","Jacques Tati","1953","France"),("Trafic","Jacques Tati",1971,"France"),
 ("Vagabond","Agnes Varda",1985,"France"),("Le Bonheur","Agnes Varda",1965,"France"),
 ("The Gleaners and I","Agnes Varda",2000,"France",3,5),("Faces Places","Agnes Varda",2017,"France",3,4),
 ("La Jetee","Chris Marker",1962,"France"),("The Young Girls of Rochefort","Jacques Demy",1967,"France"),
 ("Beauty and the Beast","Jean Cocteau",1946,"France"),("Orpheus","Jean Cocteau",1950,"France"),
 ("The Earrings of Madame de...","Max Ophuls",1953,"France"),("Le Plaisir","Max Ophuls",1952,"France"),
 ("Casque d'Or","Jacques Becker",1952,"France"),("Le Trou","Jacques Becker",1960,"France"),
 ("Forbidden Games","Rene Clement",1952,"France"),("Purple Noon","Rene Clement",1960,"France"),
 ("Le Corbeau","Henri-Georges Clouzot",1943,"France"),("Boudu Saved from Drowning","Jean Renoir",1932,"France"),
 ("La Bete Humaine","Jean Renoir",1938,"France"),("French Cancan","Jean Renoir",1955,"France"),
])
# --- Italian / Spanish / Portuguese / Greek canon
pool(CANON,3,5,[
 ("Mamma Roma","Pier Paolo Pasolini",1962,"Italy"),("The Gospel According to St. Matthew","Pier Paolo Pasolini",1964,"Italy"),
 ("Accattone","Pier Paolo Pasolini",1961,"Italy"),("Teorema","Pier Paolo Pasolini",1968,"Italy"),
 ("Senso","Luchino Visconti",1954,"Italy"),("Death in Venice","Luchino Visconti",1971,"Italy"),
 ("Ossessione","Luchino Visconti",1943,"Italy"),("Investigation of a Citizen Above Suspicion","Elio Petri",1970,"Italy"),
 ("Divorce Italian Style","Pietro Germi",1961,"Italy"),("Il Sorpasso","Dino Risi",1962,"Italy"),
 ("We All Loved Each Other So Much","Ettore Scola","1974","Italy"),("Cinema Paradiso","Giuseppe Tornatore",1988,"Italy",4,4),
 ("The Great Beauty","Paolo Sorrentino",2013,"Italy",3,4),("Il Divo","Paolo Sorrentino",2008,"Italy"),
 ("Gomorrah","Matteo Garrone",2008,"Italy"),("Dogman","Matteo Garrone",2018,"Italy"),
 ("The Conformist","Bernardo Bertolucci",1970,"Italy"),  # safety
 ("The Spider's Stratagem","Bernardo Bertolucci",1970,"Italy"),("Before the Revolution","Bernardo Bertolucci",1964,"Italy"),
 ("Viridiana","Luis Bunuel",1961,"Spain"),  # safety
 ("Los Olvidados","Luis Bunuel",1950,"Mexico"),("Nazarin","Luis Bunuel",1959,"Mexico"),
 ("The Exterminating Angel","Luis Bunuel",1962,"Mexico"),("Simon of the Desert","Luis Bunuel",1965,"Mexico"),
 ("Tristana","Luis Bunuel",1970,"Spain"),("That Obscure Object of Desire","Luis Bunuel",1977,"France"),
 ("The Phantom of Liberty","Luis Bunuel",1974,"France"),("L'Age d'Or","Luis Bunuel",1930,"France"),
 ("El Sur","Victor Erice",1983,"Spain"),("Close Your Eyes","Victor Erice",2023,"Spain",3,4),
 ("Cria Cuervos","Carlos Saura",1976,"Spain"),("The Hunt","Carlos Saura",1966,"Spain"),
 ("Aniki Bobo","Manoel de Oliveira",1942,"Portugal"),("In Vanda's Room","Pedro Costa",2000,"Portugal",2,5),
 ("Colossal Youth","Pedro Costa",2006,"Portugal"),("Vitalina Varela","Pedro Costa",2019,"Portugal",2,5),
 ("Tabu","Miguel Gomes",2012,"Portugal"),("Arabian Nights","Miguel Gomes",2015,"Portugal"),
 ("The Travelling Players","Theo Angelopoulos",1975,"Greece"),("Landscape in the Mist","Theo Angelopoulos",1988,"Greece"),
 ("Eternity and a Day","Theo Angelopoulos",1998,"Greece"),("Ulysses' Gaze","Theo Angelopoulos",1995,"Greece"),
 ("Dogtooth","Yorgos Lanthimos",2009,"Greece",3,5),("Alps","Yorgos Lanthimos",2011,"Greece"),
 ("Attenberg","Athina Rachel Tsangari",2010,"Greece"),
])
# --- German / Austrian / Scandinavian / Dutch / Belgian canon
pool(CANON,3,5,[
 ("The Last Laugh","F.W. Murnau",1924,"Germany"),("Faust","F.W. Murnau",1926,"Germany"),
 ("Pandora's Box","G.W. Pabst",1929,"Germany"),("Dr. Mabuse the Gambler","Fritz Lang",1922,"Germany"),
 ("Die Nibelungen","Fritz Lang",1924,"Germany"),("The Testament of Dr. Mabuse","Fritz Lang",1933,"Germany"),
 ("Spies","Fritz Lang",1928,"Germany"),("Kings of the Road","Wim Wenders",1976,"Germany"),
 ("Alice in the Cities","Wim Wenders",1974,"Germany"),("The American Friend","Wim Wenders",1977,"Germany"),
 ("Until the End of the World","Wim Wenders",1991,"Germany"),
 ("The Enigma of Kaspar Hauser","Werner Herzog",1974,"Germany"),("Stroszek","Werner Herzog",1977,"Germany"),
 ("Nosferatu the Vampyre","Werner Herzog",1979,"Germany"),("Heart of Glass","Werner Herzog",1976,"Germany"),
 ("Lessons of Darkness","Werner Herzog",1992,"Germany"),("Even Dwarfs Started Small","Werner Herzog",1970,"Germany"),
 ("The Bitter Tears of Petra von Kant","Rainer Werner Fassbinder",1972,"Germany"),
 ("Fox and His Friends","Rainer Werner Fassbinder",1975,"Germany"),("In a Year of 13 Moons","Rainer Werner Fassbinder",1978,"Germany"),
 ("World on a Wire","Rainer Werner Fassbinder",1973,"Germany"),("Veronika Voss","Rainer Werner Fassbinder",1982,"Germany"),
 ("Berlin Alexanderplatz","Rainer Werner Fassbinder",1980,"Germany"),("Effi Briest","Rainer Werner Fassbinder",1974,"Germany"),
 ("Young Torless","Volker Schlondorff",1966,"Germany"),("The Lost Honour of Katharina Blum","Volker Schlondorff",1975,"Germany"),
 ("The Piano Teacher","Michael Haneke",2001,"Austria",3,5),("Cache","Michael Haneke",2005,"France",3,5),
 ("The Seventh Continent","Michael Haneke",1989,"Austria"),("Time of the Wolf","Michael Haneke",2003,"France"),
 ("Phoenix","Christian Petzold",2014,"Germany",3,4),("Transit","Christian Petzold",2018,"Germany",3,4),
 ("Undine","Christian Petzold",2020,"Germany"),("Afire","Christian Petzold",2023,"Germany",3,4),
 ("Yella","Christian Petzold",2007,"Germany"),
 ("Head-On","Fatih Akin",2004,"Germany"),("The Edge of Heaven","Fatih Akin",2007,"Germany"),
 ("Everyone Else","Maren Ade",2009,"Germany"),
 ("The Phantom Carriage","Victor Sjostrom",1921,"Sweden"),
 ("Songs from the Second Floor","Roy Andersson",2000,"Sweden"),("You, the Living","Roy Andersson",2007,"Sweden"),
 ("A Pigeon Sat on a Branch Reflecting on Existence","Roy Andersson",2014,"Sweden"),
 ("The Celebration","Thomas Vinterberg",1998,"Denmark",3,5),("Submarino","Thomas Vinterberg",2010,"Denmark"),
 ("Antichrist","Lars von Trier",2009,"Denmark",3,5),("Nymphomaniac","Lars von Trier",2013,"Denmark",3,4),
 ("Europa","Lars von Trier",1991,"Denmark"),("The Element of Crime","Lars von Trier",1984,"Denmark"),
 ("The Idiots","Lars von Trier",1998,"Denmark"),("Manderlay","Lars von Trier",2005,"Denmark"),
 ("Day of Wrath","Carl Theodor Dreyer",1943,"Denmark"),("Vampyr","Carl Theodor Dreyer",1932,"Germany"),
 ("Gertrud","Carl Theodor Dreyer",1964,"Denmark"),("Master of the House","Carl Theodor Dreyer",1925,"Denmark"),
 ("The Square","Ruben Ostlund",2017,"Sweden",3,4),("Play","Ruben Ostlund",2011,"Sweden"),
 ("Reprise","Joachim Trier",2006,"Norway"),("Oslo, August 31st","Joachim Trier",2011,"Norway",3,5),
 ("Thelma","Joachim Trier",2017,"Norway",3,4),("Louder Than Bombs","Joachim Trier",2015,"Norway"),
 ("Turkish Delight","Paul Verhoeven",1973,"Netherlands"),("Soldier of Orange","Paul Verhoeven",1977,"Netherlands"),
 ("The Fourth Man","Paul Verhoeven",1983,"Netherlands"),("Elle","Paul Verhoeven",2016,"France",3,4),
 ("Benedetta","Paul Verhoeven",2021,"France",3,3),("Borgman","Alex van Warmerdam",2013,"Netherlands"),
 ("The Vanishing","George Sluizer",1988,"Netherlands",3,4),
])
# --- Soviet / Eastern Europe canon
pool(CANON,2,5,[
 ("Ivan the Terrible, Part I","Sergei Eisenstein",1944,"USSR"),("October","Sergei Eisenstein",1928,"USSR"),
 ("Strike","Sergei Eisenstein",1925,"USSR"),("Earth","Alexander Dovzhenko",1930,"USSR"),
 ("Mother","Vsevolod Pudovkin",1926,"USSR"),("The Ascent","Larisa Shepitko",1977,"USSR"),
 ("Wings","Larisa Shepitko",1966,"USSR"),("Shadows of Forgotten Ancestors","Sergei Parajanov",1965,"USSR"),
 ("Ivan's Childhood","Andrei Tarkovsky",1962,"USSR"),
 ("Hard to Be a God","Aleksei German",2013,"Russia"),("My Friend Ivan Lapshin","Aleksei German",1985,"USSR"),
 ("Russian Ark","Aleksandr Sokurov",2002,"Russia",3,5),("Mother and Son","Aleksandr Sokurov",1997,"Russia"),
 ("The Return","Andrey Zvyagintsev",2003,"Russia",3,4),("Leviathan","Andrey Zvyagintsev",2014,"Russia",3,5),
 ("Elena","Andrey Zvyagintsev",2011,"Russia"),("Brother","Aleksei Balabanov",1997,"Russia"),
 ("Ashes and Diamonds","Andrzej Wajda",1958,"Poland"),  # safety
 ("Man of Marble","Andrzej Wajda",1977,"Poland"),("Kanal","Andrzej Wajda",1957,"Poland"),
 ("Knife in the Water","Roman Polanski",1962,"Poland"),("The Saragossa Manuscript","Wojciech Has",1965,"Poland"),
 ("Dekalog","Krzysztof Kieslowski",1989,"Poland",3,5),("The Double Life of Veronique","Krzysztof Kieslowski",1991,"France",3,5),
 ("A Short Film About Killing","Krzysztof Kieslowski",1988,"Poland",3,5),("Blind Chance","Krzysztof Kieslowski",1987,"Poland"),
 ("Camera Buff","Krzysztof Kieslowski",1979,"Poland"),
 ("The Shop on Main Street","Jan Kadar",1965,"Czechoslovakia"),("Loves of a Blonde","Milos Forman",1965,"Czechoslovakia"),
 ("The Cremator","Juraj Herz",1969,"Czechoslovakia"),("Marketa Lazarova","Frantisek Vlacil",1967,"Czechoslovakia"),
 ("Valerie and Her Week of Wonders","Jaromil Jires",1970,"Czechoslovakia"),("The Firemen's Ball","Milos Forman",1967,"Czechoslovakia"),
 ("The Round-Up","Miklos Jancso",1966,"Hungary"),("The Red and the White","Miklos Jancso",1967,"Hungary"),
 ("Satantango","Bela Tarr",1994,"Hungary",2,5),("Werckmeister Harmonies","Bela Tarr",2000,"Hungary",2,5),
 ("The Turin Horse","Bela Tarr",2011,"Hungary",2,5),("Damnation","Bela Tarr",1988,"Hungary"),
 ("WR: Mysteries of the Organism","Dusan Makavejev",1971,"Yugoslavia"),
 ("When Father Was Away on Business","Emir Kusturica",1985,"Yugoslavia"),("Underground","Emir Kusturica",1995,"Yugoslavia",3,4),
 ("Time of the Gypsies","Emir Kusturica",1988,"Yugoslavia"),("Black Cat, White Cat","Emir Kusturica",1998,"Yugoslavia"),
 ("The Death of Mr. Lazarescu","Cristi Puiu",2005,"Romania"),("Police, Adjective","Corneliu Porumboiu",2009,"Romania"),
 ("12:08 East of Bucharest","Corneliu Porumboiu",2006,"Romania"),("Beyond the Hills","Cristian Mungiu",2012,"Romania"),
 ("Graduation","Cristian Mungiu",2016,"Romania"),("Aferim!","Radu Jude",2015,"Romania"),
])
# --- Japanese density (non-Kurosawa/Ozu) + classic
pool(CANON,3,5,[
 ("Floating Clouds","Mikio Naruse",1955,"Japan"),("When a Woman Ascends the Stairs","Mikio Naruse",1960,"Japan"),
 ("The Life of Oharu","Kenji Mizoguchi",1952,"Japan"),  # safety
 ("Pigs and Battleships","Shohei Imamura",1961,"Japan"),("The Insect Woman","Shohei Imamura",1963,"Japan"),
 ("Vengeance Is Mine","Shohei Imamura",1979,"Japan"),("Black Rain","Shohei Imamura",1989,"Japan"),
 ("The Eel","Shohei Imamura",1997,"Japan"),("Pale Flower","Masahiro Shinoda",1964,"Japan"),
 ("The Sword of Doom","Kihachi Okamoto",1966,"Japan"),("Samurai Rebellion","Masaki Kobayashi",1967,"Japan"),
 ("Kuroneko","Kaneto Shindo",1968,"Japan"),("The Naked Island","Kaneto Shindo",1960,"Japan"),
 ("Twenty-Four Eyes","Keisuke Kinoshita",1954,"Japan"),("The Burmese Harp","Kon Ichikawa",1956,"Japan"),
 ("Fires on the Plain","Kon Ichikawa",1959,"Japan"),("An Actor's Revenge","Kon Ichikawa",1963,"Japan"),
 ("House","Nobuhiko Obayashi",1977,"Japan",3,4),("Funeral Parade of Roses","Toshio Matsumoto",1969,"Japan"),
 ("Death by Hanging","Nagisa Oshima",1968,"Japan"),("Boy","Nagisa Oshima",1969,"Japan"),
 ("Merry Christmas Mr. Lawrence","Nagisa Oshima",1983,"Japan",3,4),
 ("Hana-bi","Takeshi Kitano",1997,"Japan",3,4),("Sonatine","Takeshi Kitano",1993,"Japan"),
 ("Kikujiro","Takeshi Kitano",1999,"Japan"),("Tampopo","Juzo Itami",1985,"Japan",3,4),
 ("A Taxing Woman","Juzo Itami",1987,"Japan"),("Cure","Kiyoshi Kurosawa",1997,"Japan"),  # keep-distinct
 ("Pulse","Kiyoshi Kurosawa",2001,"Japan"),("Tokyo Sonata","Kiyoshi Kurosawa",2008,"Japan"),
 ("Maborosi","Hirokazu Kore-eda",1995,"Japan"),("Departures","Yojiro Takita",2008,"Japan",3,4),
 ("Love Exposure","Sion Sono",2008,"Japan"),
])
# --- Chinese / HK / Taiwan density
pool(CANON,3,5,[
 ("Spring in a Small Town","Fei Mu",1948,"China"),("The Goddess","Wu Yonggang",1934,"China"),
 ("Street Angel","Yuan Muzhi",1937,"China"),("Yellow Earth","Chen Kaige",1984,"China"),
 ("Red Sorghum","Zhang Yimou",1987,"China"),("The Story of Qiu Ju","Zhang Yimou",1992,"China"),
 ("Not One Less","Zhang Yimou",1999,"China"),("The Road Home","Zhang Yimou",1999,"China"),
 ("The Blue Kite","Tian Zhuangzhuang",1993,"China"),("In the Heat of the Sun","Jiang Wen",1994,"China"),
 ("Devils on the Doorstep","Jiang Wen",2000,"China"),("Unknown Pleasures","Jia Zhangke",2002,"China"),
 ("The World","Jia Zhangke",2004,"China"),("24 City","Jia Zhangke",2008,"China"),
 ("Mountains May Depart","Jia Zhangke",2015,"China",3,4),("Suzhou River","Lou Ye",2000,"China"),
 ("Summer Palace","Lou Ye",2006,"China"),("Beijing Bicycle","Wang Xiaoshuai",2001,"China"),
 ("Center Stage","Stanley Kwan",1991,"Hong Kong"),("Rouge","Stanley Kwan",1987,"Hong Kong"),
 ("A Chinese Ghost Story","Ching Siu-tung",1987,"Hong Kong"),("Days of Being Wild","Wong Kar-wai",1990,"Hong Kong"),
 ("As Tears Go By","Wong Kar-wai",1988,"Hong Kong"),("Ashes of Time","Wong Kar-wai",1994,"Hong Kong"),
 ("The Grandmaster","Wong Kar-wai",2013,"Hong Kong",3,4),
 ("A Brighter Summer Day","Edward Yang",1991,"Taiwan"),  # safety
 ("Taipei Story","Edward Yang",1985,"Taiwan"),("The Terrorizers","Edward Yang",1986,"Taiwan"),
 ("Dust in the Wind","Hou Hsiao-hsien",1986,"Taiwan"),("A Time to Live and a Time to Die","Hou Hsiao-hsien",1985,"Taiwan"),
 ("Millennium Mambo","Hou Hsiao-hsien",2001,"Taiwan"),("Three Times","Hou Hsiao-hsien",2005,"Taiwan"),
 ("Vive L'Amour","Tsai Ming-liang",1994,"Taiwan"),("Goodbye, Dragon Inn","Tsai Ming-liang",2003,"Taiwan"),
 ("What Time Is It There?","Tsai Ming-liang",2001,"Taiwan"),("Stray Dogs","Tsai Ming-liang",2013,"Taiwan"),
])
# --- Korean classic / new wave (density)
pool(CANON,3,5,[
 ("The Housemaid","Kim Ki-young",1960,"South Korea"),("Aimless Bullet","Yu Hyun-mok",1961,"South Korea"),
 ("Sopyonje","Im Kwon-taek",1993,"South Korea"),("Chunhyang","Im Kwon-taek",2000,"South Korea"),
 ("Green Fish","Lee Chang-dong",1997,"South Korea",3,5),("Peppermint Candy","Lee Chang-dong",1999,"South Korea",3,5),
 ("Spring, Summer, Fall, Winter... and Spring","Kim Ki-duk",2003,"South Korea",3,4),("3-Iron","Kim Ki-duk",2004,"South Korea"),
 ("The Isle","Kim Ki-duk",2000,"South Korea"),("Pieta","Kim Ki-duk",2012,"South Korea"),
 ("The Day He Arrives","Hong Sang-soo",2011,"South Korea",2,5),("Right Now, Wrong Then","Hong Sang-soo",2015,"South Korea",2,5),
 ("The Day After","Hong Sang-soo",2017,"South Korea"),("Grass","Hong Sang-soo",2018,"South Korea"),
 ("The Woman Who Ran","Hong Sang-soo",2020,"South Korea",2,5),("In Another Country","Hong Sang-soo",2012,"South Korea"),
 ("Claire's Camera","Hong Sang-soo",2017,"South Korea"),("In Front of Your Face","Hong Sang-soo",2021,"South Korea"),
 ("Walk Up","Hong Sang-soo",2022,"South Korea"),("Joint Security Area","Park Chan-wook",2000,"South Korea",4,4),
 ("Sympathy for Mr. Vengeance","Park Chan-wook",2002,"South Korea",3,4),("Lady Vengeance","Park Chan-wook",2005,"South Korea",3,4),
 ("Stoker","Park Chan-wook",2013,"USA",3,4),("Mother","Bong Joon Ho",2009,"South Korea",4,5),
 ("Barking Dogs Never Bite","Bong Joon Ho",2000,"South Korea"),
])
# --- Indian / Iranian / MENA density
pool(CANON,3,5,[
 ("Days and Nights in the Forest","Satyajit Ray",1970,"India"),("The Big City","Satyajit Ray",1963,"India"),
 ("The Chess Players","Satyajit Ray",1977,"India"),("Nayak","Satyajit Ray",1966,"India"),
 ("Subarnarekha","Ritwik Ghatak",1965,"India"),("The Cloud-Capped Star","Ritwik Ghatak",1960,"India"),
 ("Pyaasa","Guru Dutt",1957,"India"),("Kaagaz Ke Phool","Guru Dutt",1959,"India"),
 ("Mother India","Mehboob Khan",1957,"India"),("Do Bigha Zamin","Bimal Roy",1953,"India"),
 ("Salaam Bombay!","Mira Nair",1988,"India"),("Mughal-e-Azam","K. Asif",1960,"India"),
 ("Where Is the Friend's House?","Abbas Kiarostami",1987,"Iran",3,5),("Close-Up","Abbas Kiarostami",1990,"Iran",3,5),
 ("The Wind Will Carry Us","Abbas Kiarostami",1999,"Iran",3,5),("Certified Copy","Abbas Kiarostami",2010,"France",3,5),
 ("Ten","Abbas Kiarostami",2002,"Iran"),("Like Someone in Love","Abbas Kiarostami",2012,"Japan"),
 ("The White Balloon","Jafar Panahi",1995,"Iran"),("The Circle","Jafar Panahi",2000,"Iran"),
 ("Offside","Jafar Panahi",2006,"Iran"),("Taxi","Jafar Panahi",2015,"Iran",3,4),
 ("3 Faces","Jafar Panahi",2018,"Iran"),("Children of Heaven","Majid Majidi",1997,"Iran"),
 ("The Color of Paradise","Majid Majidi",1999,"Iran"),("Gabbeh","Mohsen Makhmalbaf",1996,"Iran"),
 ("A Moment of Innocence","Mohsen Makhmalbaf",1996,"Iran"),("The Apple","Samira Makhmalbaf",1998,"Iran"),
 ("Turtles Can Fly","Bahman Ghobadi",2004,"Iran"),("A Time for Drunken Horses","Bahman Ghobadi",2000,"Iran"),
 ("The Cow","Dariush Mehrjui",1969,"Iran"),("Fireworks Wednesday","Asghar Farhadi",2006,"Iran",3,4),
 ("The Past","Asghar Farhadi",2013,"France",3,4),("Cairo Station","Youssef Chahine",1958,"Egypt"),
 ("Divine Intervention","Elia Suleiman",2002,"Palestine"),("It Must Be Heaven","Elia Suleiman",2019,"Palestine",3,4),
 ("The Time That Remains","Elia Suleiman",2009,"Palestine"),("Paradise Now","Hany Abu-Assad",2005,"Palestine"),
 ("Omar","Hany Abu-Assad",2013,"Palestine"),("Wadjda","Haifaa al-Mansour",2012,"Saudi Arabia"),
 ("Foxtrot","Samuel Maoz",2017,"Israel",3,4),("Synonyms","Nadav Lapid",2019,"Israel"),
 ("The Kindergarten Teacher","Nadav Lapid",2014,"Israel"),
])
# --- African / Latin American density
pool(CANON,2,5,[
 ("Mandabi","Ousmane Sembene",1968,"Senegal"),("Moolaade","Ousmane Sembene",2004,"Senegal",3,5),
 ("Camp de Thiaroye","Ousmane Sembene",1988,"Senegal"),("Hyenas","Djibril Diop Mambety",1992,"Senegal"),
 ("Finye","Souleymane Cisse",1982,"Mali"),("Yaaba","Idrissa Ouedraogo",1989,"Burkina Faso"),
 ("Tilai","Idrissa Ouedraogo",1990,"Burkina Faso"),("Soleil O","Med Hondo",1970,"Mauritania"),
 ("Sankofa","Haile Gerima",1993,"Ethiopia"),("A Screaming Man","Mahamat-Saleh Haroun",2010,"Chad"),
 ("Daratt","Mahamat-Saleh Haroun",2006,"Chad"),("Rafiki","Wanuri Kahiu",2018,"Kenya",3,4),
 ("Banel & Adama","Ramata-Toulaye Sy",2023,"Senegal",2,4),
 ("Black God, White Devil","Glauber Rocha",1964,"Brazil"),  # safety
 ("Antonio das Mortes","Glauber Rocha",1969,"Brazil"),("Barren Lives","Nelson Pereira dos Santos",1963,"Brazil"),
 ("Kiss of the Spider Woman","Hector Babenco",1985,"Brazil"),("Memories of Underdevelopment","Tomas Gutierrez Alea",1968,"Cuba"),
 ("Lucia","Humberto Solas",1968,"Cuba"),("The Hour of the Furnaces","Fernando Solanas",1968,"Argentina"),
 ("Time of the Gypsies","Emir Kusturica",1988,"Yugoslavia",2,4),  # (dup safety w/ above; norm same -> deduped)
 ("La Cienaga","Lucrecia Martel",2001,"Argentina",2,5),("The Headless Woman","Lucrecia Martel",2008,"Argentina",2,5),
 ("Zama","Lucrecia Martel",2017,"Argentina",2,5),("The Holy Girl","Lucrecia Martel",2004,"Argentina"),
 ("Nine Queens","Fabian Bielinsky",2000,"Argentina"),("Argentina, 1985","Santiago Mitre",2022,"Argentina",3,4),
 ("Silent Light","Carlos Reygadas",2007,"Mexico",2,5),("Japon","Carlos Reygadas",2002,"Mexico"),
 ("Post Tenebras Lux","Carlos Reygadas",2012,"Mexico"),("New Order","Michel Franco",2020,"Mexico",3,3),
 ("Embrace of the Serpent","Ciro Guerra",2015,"Colombia",3,4),("Monos","Alejandro Landes",2019,"Colombia",3,4),
 ("The Battle of Chile","Patricio Guzman",1975,"Chile"),("Nostalgia for the Light","Patricio Guzman",2010,"Chile",3,5),
 ("Tony Manero","Pablo Larrain",2008,"Chile"),("No","Pablo Larrain",2012,"Chile",3,4),
 ("The Club","Pablo Larrain",2015,"Chile"),("Neruda","Pablo Larrain",2016,"Chile",3,4),
 ("Mysteries of Lisbon","Raul Ruiz",2010,"Portugal/Chile",2,5),("The Milk of Sorrow","Claudia Llosa",2009,"Peru"),
])
# --- Classic Hollywood / noir / studio era
pool(CANON,3,4,[
 ("The Best Years of Our Lives","William Wyler",1946,"USA"),("The Philadelphia Story","George Cukor",1940,"USA"),
 ("It Happened One Night","Frank Capra",1934,"USA"),("Mr. Smith Goes to Washington","Frank Capra",1939,"USA"),
 ("Meet Me in St. Louis","Vincente Minnelli",1944,"USA"),("An American in Paris","Vincente Minnelli",1951,"USA"),
 ("The Band Wagon","Vincente Minnelli",1953,"USA"),("Top Hat","Mark Sandrich",1935,"USA"),
 ("Gilda","Charles Vidor",1946,"USA"),("Laura","Otto Preminger",1944,"USA"),
 ("The Big Heat","Fritz Lang",1953,"USA"),("Scarlet Street","Fritz Lang",1945,"USA"),
 ("In a Lonely Place","Nicholas Ray",1950,"USA"),("Gun Crazy","Joseph H. Lewis",1950,"USA"),
 ("Kiss Me Deadly","Robert Aldrich",1955,"USA"),("The Asphalt Jungle","John Huston",1950,"USA"),
 ("White Heat","Raoul Walsh",1949,"USA"),("The Treasure of the Sierra Madre","John Huston",1948,"USA"),
 ("Red River","Howard Hawks",1948,"USA"),("Rio Bravo","Howard Hawks",1959,"USA"),
 ("The Big Sleep","Howard Hawks",1946,"USA"),("His Girl Friday","Howard Hawks",1940,"USA"),
 ("The Man Who Shot Liberty Valance","John Ford",1962,"USA"),("My Darling Clementine","John Ford",1946,"USA"),
 ("The Grapes of Wrath","John Ford",1940,"USA"),("How Green Was My Valley","John Ford",1941,"USA"),
 ("The Lady Eve","Preston Sturges",1941,"USA"),("Sullivan's Travels","Preston Sturges",1941,"USA"),
 ("Trouble in Paradise","Ernst Lubitsch",1932,"USA"),("The Shop Around the Corner","Ernst Lubitsch",1940,"USA"),
 ("To Be or Not to Be","Ernst Lubitsch",1942,"USA"),("Ninotchka","Ernst Lubitsch",1939,"USA"),
 ("Detour","Edgar G. Ulmer",1945,"USA"),("The Killers","Robert Siodmak",1946,"USA"),
 ("Pickup on South Street","Samuel Fuller",1953,"USA"),("Shock Corridor","Samuel Fuller",1963,"USA"),
 ("A Place in the Sun","George Stevens",1951,"USA"),("Giant","George Stevens",1956,"USA"),
 ("East of Eden","Elia Kazan",1955,"USA"),("Imitation of Life","Douglas Sirk",1959,"USA"),
 ("Written on the Wind","Douglas Sirk",1956,"USA"),("All That Heaven Allows","Douglas Sirk",1955,"USA"),
 ("Johnny Guitar","Nicholas Ray",1954,"USA"),("Letter from an Unknown Woman","Max Ophuls",1948,"USA"),
 ("Sweet Smell of Success","Alexander Mackendrick",1957,"USA"),  # safety
 ("The Man in the White Suit","Alexander Mackendrick",1951,"UK"),("Kind Hearts and Coronets","Robert Hamer",1949,"UK"),
 ("The Lavender Hill Mob","Charles Crichton",1951,"UK"),
])
# --- Silent / early cinema
pool(CANON,2,5,[
 ("The Gold Rush","Charlie Chaplin",1925,"USA"),("The Crowd","King Vidor",1928,"USA"),
 ("Intolerance","D.W. Griffith",1916,"USA"),("Greed","Erich von Stroheim",1924,"USA"),
 ("The General","Buster Keaton",1926,"USA",3,5),("Sherlock Jr.","Buster Keaton",1924,"USA"),
 ("Steamboat Bill, Jr.","Buster Keaton",1928,"USA"),("Nanook of the North","Robert Flaherty",1922,"USA"),
 ("L'Atalante","Jean Vigo",1934,"France"),  # safety
 ("Zero for Conduct","Jean Vigo",1933,"France"),("Diary of a Lost Girl","G.W. Pabst",1929,"Germany"),
 ("The Story of the Last Chrysanthemum","Kenji Mizoguchi",1939,"Japan"),
 ("Napoleon","Abel Gance",1927,"France"),("The Blood of a Poet","Jean Cocteau",1932,"France"),
])

# ============ CONTEMPORARY (auteur-deepening of living catalogue directors) ============
pool(CONTEMP,4,4,[
 ("Killers of the Flower Moon","Martin Scorsese",2023,"USA",4,4),("The Age of Innocence","Martin Scorsese",1993,"USA"),
 ("Gangs of New York","Martin Scorsese",2002,"USA",4,4),("The Aviator","Martin Scorsese",2004,"USA",4,3),
 ("Shutter Island","Martin Scorsese",2010,"USA",4,4),("Hugo","Martin Scorsese",2011,"USA",3,3),
 ("Silence","Martin Scorsese",2016,"USA",3,5),("The King of Comedy","Martin Scorsese",1982,"USA",3,5),
 ("After Hours","Martin Scorsese",1985,"USA"),("Bringing Out the Dead","Martin Scorsese",1999,"USA"),
 ("Alice Doesn't Live Here Anymore","Martin Scorsese",1974,"USA"),
 ("Munich","Steven Spielberg",2005,"USA",3,4),("Lincoln","Steven Spielberg",2012,"USA",3,4),
 ("Bridge of Spies","Steven Spielberg",2015,"USA",3,3),("The Post","Steven Spielberg",2017,"USA",3,3),
 ("West Side Story","Steven Spielberg",2021,"USA",3,3),("The Fabelmans","Steven Spielberg",2022,"USA",3,4),
 ("Empire of the Sun","Steven Spielberg",1987,"USA",3,4),("The Color Purple","Steven Spielberg",1985,"USA",3,4),
 ("War of the Worlds","Steven Spielberg",2005,"USA",4,3),("Amistad","Steven Spielberg",1997,"USA"),
 ("Duel","Steven Spielberg",1971,"USA"),
 ("The Prestige","Christopher Nolan",2006,"USA",5,4),("Insomnia","Christopher Nolan",2002,"USA",3,3),
 ("Following","Christopher Nolan",1998,"UK"),("Tenet","Christopher Nolan",2020,"USA",4,3),
 ("Dunkirk","Christopher Nolan",2017,"UK",5,4),
 ("The Game","David Fincher",1997,"USA",3,3),("Panic Room","David Fincher",2002,"USA",3,3),
 ("The Curious Case of Benjamin Button","David Fincher",2008,"USA",4,3),("The Girl with the Dragon Tattoo","David Fincher",2011,"USA",4,3),
 ("Punch-Drunk Love","Paul Thomas Anderson",2002,"USA",3,5),("Hard Eight","Paul Thomas Anderson",1996,"USA"),
 ("Licorice Pizza","Paul Thomas Anderson",2021,"USA",3,4),
 ("Enemy","Denis Villeneuve",2013,"Canada",3,4),("Polytechnique","Denis Villeneuve",2009,"Canada"),
 ("The Tragedy of Macbeth","Joel Coen",2021,"USA",3,4),("O Brother, Where Art Thou?","Joel Coen",2000,"USA",4,4),
 ("True Grit","Joel Coen",2010,"USA",4,3),("Burn After Reading","Joel Coen",2008,"USA",4,3),
 ("The Man Who Wasn't There","Joel Coen",2001,"USA",3,4),("The Ballad of Buster Scruggs","Joel Coen",2018,"USA",3,4),
 ("The Hudsucker Proxy","Joel Coen",1994,"USA"),
 ("Eastern Promises","David Cronenberg",2007,"Canada",3,4),("Crash","David Cronenberg",1996,"Canada",3,5),
 ("eXistenZ","David Cronenberg",1999,"Canada",3,4),("A Dangerous Method","David Cronenberg",2011,"Canada"),
 ("Crimes of the Future","David Cronenberg",2022,"Canada",3,4),("Spider","David Cronenberg",2002,"Canada"),
 ("Wild at Heart","David Lynch",1990,"USA",3,4),("Lost Highway","David Lynch",1997,"USA",3,5),
 ("The Straight Story","David Lynch",1999,"USA",3,4),("The Elephant Man","David Lynch",1980,"USA",4,4),
 ("Inland Empire","David Lynch",2006,"USA",2,4),("Twin Peaks: Fire Walk with Me","David Lynch",1992,"USA",3,4),
 ("Julieta","Pedro Almodovar",2016,"Spain",3,4),("The Flower of My Secret","Pedro Almodovar",1995,"Spain"),
 ("Matador","Pedro Almodovar",1986,"Spain"),("Tie Me Up! Tie Me Down!","Pedro Almodovar",1989,"Spain"),
 ("High Heels","Pedro Almodovar",1991,"Spain"),
])
pool(CONTEMP,3,4,[
 ("Before Sunset","Richard Linklater",2004,"USA",4,5),("Before Midnight","Richard Linklater",2013,"USA",4,5),
 ("Waking Life","Richard Linklater",2001,"USA",3,4),("A Scanner Darkly","Richard Linklater",2006,"USA",3,4),
 ("Bernie","Richard Linklater",2011,"USA"),("Everybody Wants Some!!","Richard Linklater",2016,"USA"),
 ("Hit Man","Richard Linklater",2023,"USA",3,3),("Slacker","Richard Linklater",1990,"USA"),
 ("Sex, Lies, and Videotape","Steven Soderbergh",1989,"USA",3,4),("Traffic","Steven Soderbergh",2000,"USA",4,4),
 ("Out of Sight","Steven Soderbergh",1998,"USA",3,3),("Erin Brockovich","Steven Soderbergh",2000,"USA",4,3),
 ("The Limey","Steven Soderbergh",1999,"USA"),("Che: Part One","Steven Soderbergh",2008,"USA"),
 ("Magic Mike","Steven Soderbergh",2012,"USA",3,3),("Kimi","Steven Soderbergh",2022,"USA"),
 ("Presence","Steven Soderbergh",2024,"USA",3,3),
 ("The Squid and the Whale","Noah Baumbach",2005,"USA",3,4),("Greenberg","Noah Baumbach",2010,"USA"),
 ("While We're Young","Noah Baumbach",2014,"USA",3,3),("The Meyerowitz Stories","Noah Baumbach",2017,"USA",3,4),
 ("White Noise","Noah Baumbach",2022,"USA",3,3),("Mistress America","Noah Baumbach",2015,"USA"),
 ("Safe","Todd Haynes",1995,"USA",3,5),("Velvet Goldmine","Todd Haynes",1998,"USA",3,4),
 ("Far from Heaven","Todd Haynes",2002,"USA",3,5),("I'm Not There","Todd Haynes",2007,"USA",3,4),
 ("Dark Waters","Todd Haynes",2019,"USA",3,3),
 ("Drugstore Cowboy","Gus Van Sant",1989,"USA",3,4),("My Own Private Idaho","Gus Van Sant",1991,"USA",3,5),
 ("Elephant","Gus Van Sant",2003,"USA",3,5),("Milk","Gus Van Sant",2008,"USA",3,4),
 ("To Die For","Gus Van Sant",1995,"USA",3,3),("Paranoid Park","Gus Van Sant",2007,"USA"),
 ("The Virgin Suicides","Sofia Coppola",1999,"USA",4,4),("Marie Antoinette","Sofia Coppola",2006,"USA",3,4),
 ("Somewhere","Sofia Coppola",2010,"USA",3,3),("The Beguiled","Sofia Coppola",2017,"USA",3,3),
 ("The Bling Ring","Sofia Coppola",2013,"USA",3,3),("Priscilla","Sofia Coppola",2023,"USA",3,3),
 ("Malcolm X","Spike Lee",1992,"USA",4,5),("25th Hour","Spike Lee",2002,"USA",3,5),
 ("BlacKkKlansman","Spike Lee",2018,"USA",4,4),("Da 5 Bloods","Spike Lee",2020,"USA",3,4),
 ("Jungle Fever","Spike Lee",1991,"USA",3,4),("Inside Man","Spike Lee",2006,"USA",4,3),
 ("She's Gotta Have It","Spike Lee",1986,"USA"),("Mo' Better Blues","Spike Lee",1990,"USA"),
 ("First Man","Damien Chazelle",2018,"USA",3,4),("Babylon","Damien Chazelle",2022,"USA",3,4),
 ("The Northman","Robert Eggers",2022,"USA",4,4),("21 Grams","Alejandro Gonzalez Inarritu",2003,"Mexico",3,4),
 ("Nightmare Alley","Guillermo del Toro",2021,"USA",3,4),("Crimson Peak","Guillermo del Toro",2015,"USA",3,3),
 ("Cronos","Guillermo del Toro",1993,"Mexico"),("The Devil's Backbone","Guillermo del Toro",2001,"Spain",3,4),
])
pool(CONTEMP,3,4,[
 ("Stranger Than Paradise","Jim Jarmusch",1984,"USA",3,5),("Dead Man","Jim Jarmusch",1995,"USA",3,5),
 ("Down by Law","Jim Jarmusch",1986,"USA",3,4),("Ghost Dog: The Way of the Samurai","Jim Jarmusch",1999,"USA",3,4),
 ("Paterson","Jim Jarmusch",2016,"USA",3,5),("Only Lovers Left Alive","Jim Jarmusch",2013,"USA",3,4),
 ("Broken Flowers","Jim Jarmusch",2005,"USA",3,3),("Night on Earth","Jim Jarmusch",1991,"USA"),
 ("Mystery Train","Jim Jarmusch",1989,"USA"),
 ("Rushmore","Wes Anderson",1998,"USA",4,5),("Bottle Rocket","Wes Anderson",1996,"USA",3,4),
 ("The Life Aquatic with Steve Zissou","Wes Anderson",2004,"USA",4,4),("The Darjeeling Limited","Wes Anderson",2007,"USA",4,4),
 ("Isle of Dogs","Wes Anderson",2018,"USA",4,4),("The Phoenician Scheme","Wes Anderson",2025,"USA",4,3),
 ("Pi","Darren Aronofsky",1998,"USA",3,4),("The Fountain","Darren Aronofsky",2006,"USA",3,4),
 ("Distant","Nuri Bilge Ceylan",2002,"Turkey",2,5),("Climates","Nuri Bilge Ceylan",2006,"Turkey",2,5),
 ("Once Upon a Time in Anatolia","Nuri Bilge Ceylan",2011,"Turkey",2,5),("Three Monkeys","Nuri Bilge Ceylan",2008,"Turkey"),
 ("La Promesse","Jean-Pierre Dardenne",1996,"Belgium",2,5),("The Son","Jean-Pierre Dardenne",2002,"Belgium",2,5),
 ("Two Days, One Night","Jean-Pierre Dardenne",2014,"Belgium",3,5),("Young Ahmed","Jean-Pierre Dardenne",2019,"Belgium"),
 ("The Beat That My Heart Skipped","Jacques Audiard",2005,"France",3,4),("Read My Lips","Jacques Audiard",2001,"France"),
 ("Paris, 13th District","Jacques Audiard",2021,"France",3,3),
 ("Trouble Every Day","Claire Denis",2001,"France",2,4),("35 Shots of Rum","Claire Denis",2008,"France",2,5),
 ("White Material","Claire Denis",2009,"France",2,4),("High Life","Claire Denis",2018,"France",3,4),
 ("Let the Sunshine In","Claire Denis",2017,"France"),
 ("Summer Hours","Olivier Assayas",2008,"France",2,4),("Clouds of Sils Maria","Olivier Assayas",2014,"France",3,4),
 ("Personal Shopper","Olivier Assayas",2016,"France",3,4),("Irma Vep","Olivier Assayas",1996,"France"),
 ("Carlos","Olivier Assayas",2010,"France"),("Non-Fiction","Olivier Assayas",2018,"France"),
 ("In the House","Francois Ozon",2012,"France",3,4),("8 Women","Francois Ozon",2002,"France",3,3),
 ("Under the Sand","Francois Ozon",2000,"France"),("Frantz","Francois Ozon",2016,"France",3,3),
 ("By the Grace of God","Francois Ozon",2018,"France"),("Summer of 85","Francois Ozon",2020,"France"),
 ("Tomboy","Celine Sciamma",2011,"France",3,5),("Girlhood","Celine Sciamma",2014,"France",3,4),
 ("Water Lilies","Celine Sciamma",2007,"France"),
 ("Old Joy","Kelly Reichardt",2006,"USA",2,4),("Wendy and Lucy","Kelly Reichardt",2008,"USA",2,5),
 ("Meek's Cutoff","Kelly Reichardt",2010,"USA",2,5),("Certain Women","Kelly Reichardt",2016,"USA",2,5),
 ("Tangerine","Sean Baker",2015,"USA",3,4),("Red Rocket","Sean Baker",2021,"USA",3,4),
 ("If Beale Street Could Talk","Barry Jenkins",2018,"USA",3,5),("Medicine for Melancholy","Barry Jenkins",2008,"USA"),
 ("The Rider","Chloe Zhao",2017,"USA",2,5),
])
# --- recent festival circuit 2018-2026 NOT in catalogue/405
pool(CONTEMP,3,4,[
 ("All Quiet on the Western Front","Edward Berger",2022,"Germany",4,4),("Les Miserables","Ladj Ly",2019,"France",3,4),
 ("Martin Eden","Pietro Marcello",2019,"Italy",2,4),("The Painted Bird","Vaclav Marhoul",2019,"Czechia",2,4),
 ("The Hand of God","Paolo Sorrentino",2021,"Italy",3,4),("The Souvenir Part II","Joanna Hogg",2021,"UK",2,4),
 ("Annette","Leos Carax",2021,"France",3,4),("Spencer","Pablo Larrain",2021,"Chile",3,4),
 ("The Card Counter","Paul Schrader",2021,"USA",3,4),("First Reformed","Paul Schrader",2017,"USA",3,5),
 ("Bones and All","Luca Guadagnino",2022,"USA",3,4),("R.M.N.","Cristian Mungiu",2022,"Romania",2,4),
 ("Inside the Yellow Cocoon Shell","Pham Thien An",2023,"Vietnam",2,5),("American Fiction","Cord Jefferson",2023,"USA",3,4),
 ("Origin","Ava DuVernay",2023,"USA",3,3),("Io Capitano","Matteo Garrone",2023,"Italy",3,4),
 ("Green Border","Agnieszka Holland",2023,"Poland",2,4),("The Promised Land","Nikolaj Arcel",2023,"Denmark",3,3),
 ("The Eternal Memory","Maite Alberdi",2023,"Chile",2,4),("Grand Tour","Miguel Gomes",2024,"Portugal",2,4),
 ("Caught by the Tides","Jia Zhangke",2024,"China",2,4),("Universal Language","Matthew Rankin",2024,"Canada",2,4),
 ("Santosh","Sandhya Suri",2024,"India",3,4),("Sujo","Astrid Rondero",2024,"Mexico",2,4),
 ("Queer","Luca Guadagnino",2024,"Italy",3,4),("Maria","Pablo Larrain",2024,"Chile",3,3),
 ("Babygirl","Halina Reijn",2024,"USA",3,3),("Megalopolis","Francis Ford Coppola",2024,"USA",3,3),
 ("Nouvelle Vague","Richard Linklater",2025,"USA",3,4),("Die My Love","Lynne Ramsay",2025,"USA",3,4),
 ("Eddington","Ari Aster",2025,"USA",4,4),("Materialists","Celine Song",2025,"USA",3,4),
 ("After the Hunt","Luca Guadagnino",2025,"USA",3,3),("Jay Kelly","Noah Baumbach",2025,"USA",3,3),
 ("Warfare","Alex Garland",2025,"USA",4,3),("Resurrection","Bi Gan",2025,"China",2,4),
 ("The Hand of God","Paolo Sorrentino",2021,"Italy",3,4),
])
# --- streaming prestige (Netflix / A24 / Neon) not in catalogue
pool(CONTEMP,4,4,[
 ("Mudbound","Dee Rees",2017,"USA",3,4),("Beasts of No Nation","Cary Joji Fukunaga",2015,"USA",3,4),
 ("Ma Rainey's Black Bottom","George C. Wolfe",2020,"USA",3,4),("The Two Popes","Fernando Meirelles",2019,"UK",3,3),
 ("Blonde","Andrew Dominik",2022,"USA",3,3),("The Assassination of Jesse James by the Coward Robert Ford","Andrew Dominik",2007,"USA",3,5),
 ("Glass Onion: A Knives Out Mystery","Rian Johnson",2022,"USA",5,3),("Don't Look Up","Adam McKay",2021,"USA",4,3),
 ("Klaus","Sergio Pablos",2019,"Spain",4,3),("The Mitchells vs. the Machines","Mike Rianda",2021,"USA",4,3),
 ("Nimona","Nick Bruno",2023,"USA",4,3),("Rebel Ridge","Jeremy Saulnier",2024,"USA",4,3),
 ("Green Room","Jeremy Saulnier",2015,"USA",3,4),("Blue Ruin","Jeremy Saulnier",2013,"USA",3,4),
 ("Good Time","Benny Safdie",2017,"USA",3,5),("The Death of Stalin","Armando Iannucci",2017,"UK",4,4),
 ("The Disaster Artist","James Franco",2017,"USA",4,3),("Mid90s","Jonah Hill",2018,"USA",3,4),
 ("The Last Black Man in San Francisco","Joe Talbot",2019,"USA",3,4),("Saint Maud","Rose Glass",2019,"UK",3,4),
 ("Love Lies Bleeding","Rose Glass",2024,"USA",3,4),("Dream Scenario","Kristoffer Borgli",2023,"USA",3,4),
 ("We Live in Time","John Crowley",2024,"UK",4,3),("Heretic","Scott Beck",2024,"USA",4,3),
 ("Bodies Bodies Bodies","Halina Reijn",2022,"USA",3,3),("Friendship","Andrew DeYoung",2024,"USA",3,3),
 ("Ingrid Goes West","Matt Spicer",2017,"USA",3,4),("Colossal","Nacho Vigalondo",2016,"Spain",3,3),
 ("Pig","Michael Sarnoski",2021,"USA",3,4),("Palm Springs","Max Barbakow",2020,"USA",4,3),
 ("Vox Lux","Brady Corbet",2018,"USA",3,4),("The Childhood of a Leader","Brady Corbet",2015,"USA",2,4),
 ("I, Tonya","Craig Gillespie",2017,"USA",4,3),("Vice","Adam McKay",2018,"USA",3,3),
 ("Judas and the Black Messiah","Shaka King",2021,"USA",3,4),("One Night in Miami","Regina King",2020,"USA",3,4),
])
# --- world contemporary (East Asia / South Asia / MENA / Latin) high-density
pool(CONTEMP,3,4,[
 ("Shoplifters","Hirokazu Kore-eda",2018,"Japan",3,5),  # safety (in catalogue)
 ("An Elephant Sitting Still","Hu Bo",2018,"China",2,5),  # safety (in 405)
 ("A Sun","Chung Mong-hong",2019,"Taiwan",3,4),  # safety
 ("The Wild Goose Lake","Diao Yinan",2019,"China",3,4),  # safety
 ("Black Coal, Thin Ice","Diao Yinan",2014,"China",3,4),("Blind Massage","Lou Ye",2014,"China",2,4),
 ("Spring Fever","Lou Ye",2009,"China",2,4),("Kaili Blues","Bi Gan",2015,"China",2,4),
 ("So Long, My Son","Wang Xiaoshuai",2019,"China",2,4),  # safety
 ("Tokyo Sonata","Kiyoshi Kurosawa",2008,"Japan",2,4),  # safety (dup w/ canon -> deduped)
 ("Happy Hour","Ryusuke Hamaguchi",2015,"Japan",2,5),  # safety (in)
 ("Shin Godzilla","Hideaki Anno",2016,"Japan",4,3),("Godzilla Minus One","Takashi Yamazaki",2023,"Japan",5,3),
 ("Sweet Bean","Naomi Kawase",2015,"Japan",2,4),("Still the Water","Naomi Kawase",2014,"Japan"),
 ("The Lunchbox","Ritesh Batra",2013,"India",3,4),("Court","Chaitanya Tamhane",2014,"India",2,5),
 ("The Disciple","Chaitanya Tamhane",2020,"India",2,5),("Masaan","Neeraj Ghaywan",2015,"India",3,4),
 ("Gangs of Wasseypur","Anurag Kashyap",2012,"India",3,4),("Ship of Theseus","Anand Gandhi",2012,"India",2,4),
 ("Tumbbad","Rahi Anil Barve",2018,"India",3,4),("Jallikattu","Lijo Jose Pellissery",2019,"India",2,4),
 ("A Death in the Gunj","Konkona Sen Sharma",2016,"India",2,3),("Sir","Rohena Gera",2018,"India",2,3),
 ("The Blue Caftan","Maryam Touzani",2022,"Morocco",2,4),  # safety
 ("The Man Who Sold His Skin","Kaouther Ben Hania",2020,"Tunisia",3,4),("Beauty and the Dogs","Kaouther Ben Hania",2017,"Tunisia",2,4),
 ("Lebanon","Samuel Maoz",2009,"Israel",2,4),("Ahed's Knee","Nadav Lapid",2021,"Israel",2,4),
 ("Wadjda","Haifaa al-Mansour",2012,"Saudi Arabia",3,4),  # safety
 ("The Insult","Ziad Doueiri",2017,"Lebanon",3,4),("Capernaum","Nadine Labaki",2018,"Lebanon",3,4),  # safety (in)
 ("No Other Land","Basel Adra",2024,"Palestine",3,5),
])

# ============ POPULAR / GENRE DEPTH ============
# --- franchises / blockbusters (high demand, has crit lit)
pool(POP,5,3,[
 ("Star Wars: Episode III - Revenge of the Sith","George Lucas",2005,"USA"),
 ("Star Wars: Episode I - The Phantom Menace","George Lucas",1999,"USA",5,2),
 ("Star Wars: The Force Awakens","J.J. Abrams",2015,"USA"),("Star Wars: The Last Jedi","Rian Johnson",2017,"USA",5,4),
 ("Rogue One: A Star Wars Story","Gareth Edwards",2016,"USA"),
 ("Captain America: Civil War","Anthony Russo",2016,"USA"),("Thor: Ragnarok","Taika Waititi",2017,"USA"),
 ("Guardians of the Galaxy Vol. 2","James Gunn",2017,"USA"),("Doctor Strange","Scott Derrickson",2016,"USA",5,2),
 ("Spider-Man: Homecoming","Jon Watts",2017,"USA"),("Spider-Man: No Way Home","Jon Watts",2021,"USA",5,3),
 ("Shang-Chi and the Legend of the Ten Rings","Destin Daniel Cretton",2021,"USA"),
 ("Black Panther: Wakanda Forever","Ryan Coogler",2022,"USA",5,3),("Captain Marvel","Anna Boden",2019,"USA"),
 ("Deadpool & Wolverine","Shawn Levy",2024,"USA"),("Thunderbolts","Jake Schreier",2025,"USA"),
 ("Man of Steel","Zack Snyder",2013,"USA"),("Aquaman","James Wan",2018,"USA"),
 ("The Suicide Squad","James Gunn",2021,"USA",5,3),("Superman","James Gunn",2025,"USA"),
 ("The Dark Knight Rises","Christopher Nolan",2012,"USA",5,4),
 ("The Hobbit: An Unexpected Journey","Peter Jackson",2012,"NZ/USA"),
 ("The Hobbit: The Desolation of Smaug","Peter Jackson",2013,"NZ/USA"),
 ("Harry Potter and the Chamber of Secrets","Chris Columbus",2002,"UK"),
 ("Harry Potter and the Goblet of Fire","Mike Newell",2005,"UK"),
 ("Harry Potter and the Order of the Phoenix","David Yates",2007,"UK"),
 ("Harry Potter and the Half-Blood Prince","David Yates",2009,"UK"),
 ("Harry Potter and the Deathly Hallows: Part 2","David Yates",2011,"UK",5,3),
 ("Fantastic Beasts and Where to Find Them","David Yates",2016,"UK"),
 ("Goldfinger","Guy Hamilton",1964,"UK",4,3),("Dr. No","Terence Young",1962,"UK",4,3),
 ("From Russia with Love","Terence Young",1963,"UK"),("GoldenEye","Martin Campbell",1995,"UK"),
 ("No Time to Die","Cary Joji Fukunaga",2021,"UK"),("Spectre","Sam Mendes",2015,"UK"),
 ("Mission: Impossible - Rogue Nation","Christopher McQuarrie",2015,"USA"),
 ("Mission: Impossible - Fallout","Christopher McQuarrie",2018,"USA",5,3),
 ("Mission: Impossible - Dead Reckoning Part One","Christopher McQuarrie",2023,"USA"),
 ("The Matrix Reloaded","Lana Wachowski",2003,"USA",4,3),("The Matrix Resurrections","Lana Wachowski",2021,"USA",4,3),
 ("Jurassic World","Colin Trevorrow",2015,"USA"),("The Lost World: Jurassic Park","Steven Spielberg",1997,"USA"),
 ("Prometheus","Ridley Scott",2012,"USA",4,4),("Alien: Covenant","Ridley Scott",2017,"USA"),
 ("Alien 3","David Fincher",1992,"USA",4,3),("Alien: Romulus","Fede Alvarez",2024,"USA"),
 ("Terminator 3: Rise of the Machines","Jonathan Mostow",2003,"USA",4,2),("Terminator: Dark Fate","Tim Miller",2019,"USA"),
 ("Pirates of the Caribbean: The Curse of the Black Pearl","Gore Verbinski",2003,"USA",5,3),
 ("Avatar: The Way of Water","James Cameron",2022,"USA",5,3),
 ("John Wick: Chapter 2","Chad Stahelski",2017,"USA"),("John Wick: Chapter 3 - Parabellum","Chad Stahelski",2019,"USA"),
 ("John Wick: Chapter 4","Chad Stahelski",2023,"USA",5,3),
 ("Rocky II","Sylvester Stallone",1979,"USA"),("Rocky III","Sylvester Stallone",1982,"USA"),
 ("Creed","Ryan Coogler",2015,"USA",4,3),("Creed II","Steven Caple Jr.",2018,"USA"),
 ("Fast Five","Justin Lin",2011,"USA"),("Gladiator II","Ridley Scott",2024,"USA"),
 ("Wicked","Jon M. Chu",2024,"USA",5,3),("Wonka","Paul King",2023,"USA"),
 ("The Super Mario Bros. Movie","Aaron Horvath",2023,"USA"),("Joker: Folie a Deux","Todd Phillips",2024,"USA",4,3),
 ("Toy Story 4","Josh Cooley",2019,"USA"),("Finding Dory","Andrew Stanton",2016,"USA"),
 ("Incredibles 2","Brad Bird",2018,"USA"),("Frozen II","Chris Buck",2019,"USA"),
 ("Monsters University","Dan Scanlon",2013,"USA"),("Cars","John Lasseter",2006,"USA",4,2),
])
# --- modern + classic horror gaps (high demand, mid density)
pool(POP,4,3,[
 ("The Omen","Richard Donner",1976,"USA",4,4),("Poltergeist","Tobe Hooper",1982,"USA",4,3),
 ("Carrie","Brian De Palma",1976,"USA",4,4),("Re-Animator","Stuart Gordon",1985,"USA",3,4),
 ("Friday the 13th","Sean S. Cunningham",1980,"USA",4,3),("The Howling","Joe Dante",1981,"USA",3,3),
 ("The Fog","John Carpenter",1980,"USA",3,3),("Evil Dead II","Sam Raimi",1987,"USA",4,4),
 ("The Conjuring 2","James Wan",2016,"USA"),("Insidious","James Wan",2010,"USA"),
 ("Sinister","Scott Derrickson",2012,"USA"),("It Chapter Two","Andy Muschietti",2019,"USA"),
 ("A Quiet Place Part II","John Krasinski",2020,"USA"),("Smile","Parker Finn",2022,"USA"),
 ("Barbarian","Zach Cregger","2022","USA",4,4),("The Black Phone","Scott Derrickson",2021,"USA"),
 ("The Invisible Man","Leigh Whannell",2020,"USA",4,4),("Doctor Sleep","Mike Flanagan",2019,"USA"),
 ("Halloween","David Gordon Green",2018,"USA"),("Scream","Matt Bettinelli-Olpin",2022,"USA"),
 ("The Nun","Corin Hardy",2018,"USA",4,2),("Evil Dead","Fede Alvarez",2013,"USA"),
 ("Terrifier 2","Damien Leone",2022,"USA",4,3),("Late Night with the Devil","Cameron Cairnes",2023,"Australia",3,4),
 ("The First Omen","Arkasha Stevenson",2024,"USA",3,4),("Abigail","Matt Bettinelli-Olpin",2024,"USA"),
 ("Nosferatu","Robert Eggers",2024,"USA",4,4),("Weapons","Zach Cregger",2025,"USA",4,4),
 ("Bring Her Back","Danny Philippou",2025,"Australia",4,4),("Cuckoo","Tilman Singer",2024,"Germany",3,3),
 ("Immaculate","Michael Mohan",2024,"USA",3,3),("The Monkey","Osgood Perkins",2025,"USA",4,3),
 ("Malignant","James Wan",2021,"USA",3,3),("Gerald's Game","Mike Flanagan",2017,"USA",3,3),
 ("The Medium","Banjong Pisanthanakun",2021,"Thailand",3,3),("Gonjiam: Haunted Asylum","Jung Bum-shik",2018,"South Korea",3,3),
])
# --- anime films + Ghibli remaining (high demand)
pool(POP,4,3,[
 ("Whisper of the Heart","Yoshifumi Kondo",1995,"Japan",4,4),("The Cat Returns","Hiroyuki Morita",2002,"Japan"),
 ("Pom Poko","Isao Takahata",1994,"Japan",3,4),("From Up on Poppy Hill","Goro Miyazaki",2011,"Japan"),
 ("The Secret World of Arrietty","Hiromasa Yonebayashi",2010,"Japan"),("When Marnie Was There","Hiromasa Yonebayashi",2014,"Japan",4,4),
 ("Ocean Waves","Tomomi Mochizuki",1993,"Japan"),
 ("5 Centimeters per Second","Makoto Shinkai",2007,"Japan",4,4),("The Garden of Words","Makoto Shinkai",2013,"Japan"),
 ("Summer Wars","Mamoru Hosoda",2009,"Japan",4,3),("Mirai","Mamoru Hosoda",2018,"Japan"),
 ("The Boy and the Beast","Mamoru Hosoda",2015,"Japan"),("Mind Game","Masaaki Yuasa",2004,"Japan",3,5),
 ("The Night Is Short, Walk On Girl","Masaaki Yuasa",2017,"Japan",3,4),("Ride Your Wave","Masaaki Yuasa",2019,"Japan"),
 ("Demon Slayer: Mugen Train","Haruo Sotozaki",2020,"Japan",5,3),("Jujutsu Kaisen 0","Sunghoo Park",2021,"Japan",4,3),
 ("The First Slam Dunk","Takehiko Inoue",2022,"Japan",4,3),("Look Back","Kiyotaka Oshiyama",2024,"Japan",4,4),
 ("In This Corner of the World","Sunao Katabuchi",2016,"Japan",3,5),("Maquia: When the Promised Flower Blooms","Mari Okada",2018,"Japan"),
 ("Children of the Sea","Ayumu Watanabe",2019,"Japan"),("Belladonna of Sadness","Eiichi Yamamoto",1973,"Japan",2,4),
 ("Angel's Egg","Mamoru Oshii",1985,"Japan",2,5),("Ghost in the Shell 2: Innocence","Mamoru Oshii",2004,"Japan",3,4),
 ("Jin-Roh: The Wolf Brigade","Hiroyuki Okiura",1999,"Japan",3,4),("Metropolis","Rintaro",2001,"Japan",3,4),
 ("Steamboy","Katsuhiro Otomo",2004,"Japan",3,3),("Redline","Takeshi Koike",2009,"Japan",3,3),
 ("Vampire Hunter D: Bloodlust","Yoshiaki Kawajiri",2000,"Japan",3,3),("Memories","Katsuhiro Otomo",1995,"Japan",2,4),
])
# --- Asian commercial cinema (K-cinema / wuxia / South Asian blockbuster)
pool(POP,4,3,[
 ("The Chaser","Na Hong-jin",2008,"South Korea",4,4),("The Man from Nowhere","Lee Jeong-beom",2010,"South Korea",4,3),
 ("The Yellow Sea","Na Hong-jin",2010,"South Korea",3,4),("New World","Park Hoon-jung",2013,"South Korea",4,4),
 ("A Bittersweet Life","Kim Jee-woon",2005,"South Korea",4,4),("A Taxi Driver","Jang Hoon",2017,"South Korea",4,3),
 ("The Attorney","Yang Woo-suk",2013,"South Korea",3,3),("Veteran","Ryoo Seung-wan",2015,"South Korea",4,3),
 ("The Roundup","Lee Sang-yong",2022,"South Korea",4,2),("Extreme Job","Lee Byeong-heon",2019,"South Korea",4,3),
 ("Exhuma","Jang Jae-hyun",2024,"South Korea",4,3),("12.12: The Day","Kim Sung-su",2023,"South Korea",4,3),
 ("Hunt","Lee Jung-jae",2022,"South Korea",3,3),("Concrete Utopia","Um Tae-hwa",2023,"South Korea",3,3),
 ("The Gangster, the Cop, the Devil","Lee Won-tae",2019,"South Korea",3,3),("The Spy Gone North","Yoon Jong-bin",2018,"South Korea",3,4),
 ("Along with the Gods: The Two Worlds","Kim Yong-hwa",2017,"South Korea",4,2),("The Witch: Part 1","Park Hoon-jung",2018,"South Korea",3,3),
 ("Kill Boksoon","Byun Sung-hyun",2023,"South Korea",3,2),("The Wailing","Na Hong-jin",2016,"South Korea",4,4),  # safety in
 ("Once Upon a Time in China","Tsui Hark",1991,"Hong Kong",3,4),("A Better Tomorrow","John Woo",1986,"Hong Kong",3,4),
 ("Drunken Master II","Lau Kar-leung",1994,"Hong Kong",3,3),("Shaolin Soccer","Stephen Chow",2001,"Hong Kong",4,3),
 ("The Raid 2","Gareth Evans",2014,"Indonesia",4,4),("Ong-Bak","Prachya Pinkaew",2003,"Thailand",4,3),
 ("Red Cliff","John Woo",2008,"China",3,3),("Shadow","Zhang Yimou",2018,"China",3,4),
 ("Baahubali: The Beginning","S.S. Rajamouli",2015,"India",5,3),("Baahubali 2: The Conclusion","S.S. Rajamouli",2017,"India",5,3),
 ("K.G.F: Chapter 2","Prashanth Neel",2022,"India",4,2),("3 Idiots","Rajkumar Hirani",2009,"India",5,3),
 ("Dangal","Nitesh Tiwari",2016,"India",5,3),("PK","Rajkumar Hirani",2014,"India",4,3),
 ("Lagaan","Ashutosh Gowariker",2001,"India",4,4),("Devdas","Sanjay Leela Bhansali",2002,"India",4,3),
 ("Dil Se","Mani Ratnam",1998,"India",3,4),("Gully Boy","Zoya Akhtar",2019,"India",4,3),
 ("Andhadhun","Sriram Raghavan",2018,"India",4,3),("Jawan","Atlee",2023,"India",4,2),
 ("Stree","Amar Kaushik",2018,"India",4,3),
])
# --- documentaries (mid demand, high density)
pool(POP,3,4,[
 ("Grey Gardens","Albert Maysles",1975,"USA",3,5),("Gimme Shelter","Albert Maysles",1970,"USA",3,4),
 ("Harlan County USA","Barbara Kopple",1976,"USA",2,5),("Titicut Follies","Frederick Wiseman",1967,"USA",2,5),
 ("High School","Frederick Wiseman",1968,"USA",2,4),("Chronicle of a Summer","Jean Rouch",1961,"France",2,5),
 ("The Sorrow and the Pity","Marcel Ophuls",1969,"France",2,5),("Dont Look Back","D.A. Pennebaker",1967,"USA",3,4),
 ("Woodstock","Michael Wadleigh",1970,"USA",3,3),("Crumb","Terry Zwigoff",1994,"USA",3,4),
 ("American Movie","Chris Smith",1999,"USA",3,4),("Capturing the Friedmans","Andrew Jarecki",2003,"USA",3,4),
 ("The Fog of War","Errol Morris",2003,"USA",3,5),("Gates of Heaven","Errol Morris",1978,"USA",2,4),
 ("Bowling for Columbine","Michael Moore",2002,"USA",4,3),("Fahrenheit 9/11","Michael Moore",2004,"USA",4,3),
 ("Exit Through the Gift Shop","Banksy",2010,"UK",4,4),("The Imposter","Bart Layton",2012,"UK",3,4),
 ("Cartel Land","Matthew Heineman",2015,"USA",3,4),("Amy","Asif Kapadia",2015,"UK",4,4),
 ("Weiner","Josh Kriegman",2016,"USA",3,4),("I Am Not Your Negro","Raoul Peck",2016,"USA",3,5),
 ("Won't You Be My Neighbor?","Morgan Neville",2018,"USA",4,3),("Three Identical Strangers","Tim Wardle",2018,"UK",4,3),
 ("Apollo 11","Todd Douglas Miller",2019,"USA",4,4),("American Factory","Steven Bognar",2019,"USA",3,4),
 ("For Sama","Waad Al-Kateab",2019,"Syria",3,5),("Time","Garrett Bradley",2020,"USA",3,4),
 ("Dick Johnson Is Dead","Kirsten Johnson",2020,"USA",3,4),("Boys State","Amanda McBaine",2020,"USA",3,3),
 ("Fire of Love","Sara Dosa",2022,"USA",3,4),("All the Beauty and the Bloodshed","Laura Poitras",2022,"USA",3,5),
 ("Navalny","Daniel Roher",2022,"USA",4,3),("20 Days in Mariupol","Mstyslav Chernov",2023,"Ukraine",3,5),
 ("Beyond Utopia","Madeleine Gavin",2023,"USA",3,4),("Sugarcane","Julian Brave NoiseCat",2024,"USA",3,4),
 ("Black Box Diaries","Shiori Ito",2024,"Japan",3,4),("The Up Series","Michael Apted",1964,"UK",2,5),
])
# --- comedy / cult / popular drama-thriller gaps
pool(POP,3,3,[
 ("The Rocky Horror Picture Show","Jim Sharman",1975,"UK",4,3),("Harold and Maude","Hal Ashby",1971,"USA",3,5),
 ("Being There","Hal Ashby",1979,"USA",3,5),("Withnail and I","Bruce Robinson",1987,"UK",3,4),
 ("Repo Man","Alex Cox",1984,"USA",3,4),("Pink Flamingos","John Waters",1972,"USA",2,4),
 ("Idiocracy","Mike Judge",2006,"USA",4,3),("The World's End","Edgar Wright",2013,"UK",4,3),
 ("Hot Rod no","",0,"",2,2),
 ("Sing Street","John Carney",2016,"Ireland",4,4),("Once","John Carney",2007,"Ireland",4,4),
 ("Moulin Rouge!","Baz Luhrmann",2001,"USA",4,3),("Rocketman","Dexter Fletcher",2019,"UK",4,3),
 ("Dancer in the Dark","Lars von Trier",2000,"Denmark",3,5),("Chicago","Rob Marshall",2002,"USA",4,3),
 ("The Spectacular Now","James Ponsoldt",2013,"USA",3,3),("The Perks of Being a Wallflower","Stephen Chbosky",2012,"USA",4,3),
 ("Booksmart","Olivia Wilde",2019,"USA",4,3),("Say Anything...","Cameron Crowe",1989,"USA",3,3),
 ("Mystic River","Clint Eastwood",2003,"USA",4,4),("The Town","Ben Affleck",2010,"USA",4,3),
 ("Gone Baby Gone","Ben Affleck",2007,"USA",3,4),("Michael Clayton","Tony Gilroy",2007,"USA",3,4),
 ("Argo","Ben Affleck",2012,"USA",4,3),("Hell or High Water","David Mackenzie",2016,"USA",4,4),
 ("Wind River","Taylor Sheridan",2017,"USA",4,3),("12 Years a Slave","Steve McQueen",2013,"UK",4,5),
 ("The King's Speech","Tom Hooper",2010,"UK",4,3),("The Imitation Game","Morten Tyldum",2014,"UK",4,3),
 ("1917","Sam Mendes",2019,"UK",5,4),("Hacksaw Ridge","Mel Gibson",2016,"USA",4,3),
 ("American Sniper","Clint Eastwood",2014,"USA",4,3),("The Hurt Locker","Kathryn Bigelow",2008,"USA",4,5),
 ("Zero Dark Thirty","Kathryn Bigelow",2012,"USA",4,4),("Letters from Iwo Jima","Clint Eastwood",2006,"USA",3,4),
 ("Edge of Tomorrow","Doug Liman",2014,"USA",4,3),("Looper","Rian Johnson",2012,"USA",4,4),
 ("Source Code","Duncan Jones",2011,"USA",4,3),("Sunshine","Danny Boyle",2007,"UK",4,4),
 ("Pacific Rim","Guillermo del Toro",2013,"USA",4,3),("Contact","Robert Zemeckis",1997,"USA",4,4),
])

# ============ SUPPLEMENT: more Contemporary (to hold 33%) ============
pool(CONTEMP,3,4,[
 ("Leave No Trace","Debra Granik",2018,"USA",3,5),("Winter's Bone","Debra Granik",2010,"USA",3,4),
 ("Never Rarely Sometimes Always","Eliza Hittman",2020,"USA",3,4),("Beach Rats","Eliza Hittman",2017,"USA"),
 ("Beasts of the Southern Wild","Benh Zeitlin",2012,"USA",3,4),("Wildlife","Paul Dano",2018,"USA",3,4),
 ("Shirley","Josephine Decker",2020,"USA",2,4),("Thoroughbreds","Cory Finley",2017,"USA",3,4),
 ("Eighth Grade","Bo Burnham",2018,"USA",4,4),("Honey Boy","Alma Har'el",2019,"USA",3,3),
 ("Hustlers","Lorene Scafaria",2019,"USA",4,3),("Passing","Rebecca Hall",2021,"USA",3,4),
 ("Malcolm & Marie","Sam Levinson",2021,"USA",3,2),("Earth Mama","Savanah Leaf",2023,"USA",2,4),
 ("Ad Astra","James Gray",2019,"USA",3,4),("The Lost City of Z","James Gray",2016,"USA",3,4),
 ("Armageddon Time","James Gray",2022,"USA",3,4),("Two Lovers","James Gray",2008,"USA",3,4),
 ("We Own the Night","James Gray",2007,"USA",3,3),
 ("Laurence Anyways","Xavier Dolan",2012,"Canada",2,4),("It's Only the End of the World","Xavier Dolan",2016,"Canada",2,3),
 ("Heartbeats","Xavier Dolan",2010,"Canada",2,3),("I Killed My Mother","Xavier Dolan",2009,"Canada"),
 ("Blue Is the Warmest Color","Abdellatif Kechiche",2013,"France",4,4),("The Class","Laurent Cantet",2008,"France",3,4),
 ("Of Gods and Men","Xavier Beauvois",2010,"France",3,4),("Mustang","Deniz Gamze Erguven",2015,"France",3,4),
 ("120 BPM (Beats per Minute)","Robin Campillo",2017,"France",3,4),("Happening","Audrey Diwan",2021,"France",3,4),
 ("Custody","Xavier Legrand",2017,"France",3,4),("Divines","Houda Benyamina",2016,"France",3,3),
 ("Weekend","Andrew Haigh",2011,"UK",3,4),("45 Years","Andrew Haigh",2015,"UK",3,4),
 ("Lean on Pete","Andrew Haigh",2017,"UK",3,4),("God's Own Country","Francis Lee",2017,"UK",3,4),
 ("Ammonite","Francis Lee",2020,"UK",3,3),("I, Daniel Blake","Ken Loach",2016,"UK",3,5),
 ("The Wind That Shakes the Barley","Ken Loach",2006,"UK",3,4),("Kes","Ken Loach",1969,"UK",3,5),
 ("The Old Oak","Ken Loach",2023,"UK",3,4),("House of Hummingbird","Kim Bora",2018,"South Korea",2,4),
 ("Microhabitat","Jeon Go-woon",2017,"South Korea",2,3),("A Fantastic Woman","Sebastian Lelio",2017,"Chile",3,4),
 ("Rojo","Benjamin Naishtat",2018,"Argentina",2,4),("I'm No Longer Here","Fernando Frias",2019,"Mexico",3,3),
 ("Tigers Are Not Afraid","Issa Lopez",2017,"Mexico",3,3),("La Llorona","Jayro Bustamante",2019,"Guatemala",3,3),
 ("Ixcanul","Jayro Bustamante",2015,"Guatemala",2,4),("Prayers for the Stolen","Tatiana Huezo",2021,"Mexico",2,4),
 ("On Becoming a Guinea Fowl","Rungano Nyoni",2024,"Zambia",2,4),("Vermiglio","Maura Delpero",2024,"Italy",2,4),
 ("April","Dea Kulumbegashvili",2024,"Georgia",2,5),("Beginning","Dea Kulumbegashvili",2020,"Georgia",2,4),
 ("Black Dog","Guan Hu",2024,"China",2,4),("September 5","Tim Fehlbaum",2024,"Germany",3,3),
 ("The Order","Justin Kurzel",2024,"USA",3,3),("Snowtown","Justin Kurzel",2011,"Australia",2,4),
 ("Nitram","Justin Kurzel",2021,"Australia",2,4),("Sorry, Baby","Eva Victor",2025,"USA",3,4),
 ("Highest 2 Lowest","Spike Lee",2025,"USA",3,3),("If I Had Legs I'd Kick You","Mary Bronstein",2025,"USA",3,4),
 ("Kontinental 25","Radu Jude",2025,"Romania",2,4),("The Ballad of a Small Player","Edward Berger",2025,"UK",3,3),
 ("Hedda","Nia DaCosta",2025,"USA",3,3),("Roofman","Derek Cianfrance",2025,"USA",3,3),
 ("Blue Valentine","Derek Cianfrance",2010,"USA",3,4),("The Place Beyond the Pines","Derek Cianfrance",2012,"USA",4,4),
 ("Wild Tales no","",0,"",2,2),
])
# ============ SUPPLEMENT: more Popular/genre (to hold 27%) ============
pool(POP,4,3,[
 ("Mad Max Beyond Thunderdome","George Miller",1985,"Australia",4,3),
 ("Indiana Jones and the Kingdom of the Crystal Skull","Steven Spielberg",2008,"USA",4,2),
 ("Star Wars: The Rise of Skywalker","J.J. Abrams",2019,"USA",4,2),
 ("Star Wars: Episode II - Attack of the Clones","George Lucas",2002,"USA",4,2),
 ("Solo: A Star Wars Story","Ron Howard",2018,"USA",4,2),
 ("The Hobbit: The Battle of the Five Armies","Peter Jackson",2014,"NZ/USA",4,2),
 ("Harry Potter and the Deathly Hallows: Part 1","David Yates",2010,"UK",4,3),
 ("Quantum of Solace","Marc Forster",2008,"UK",4,2),("The Spy Who Loved Me","Lewis Gilbert",1977,"UK",3,3),
 ("Mission: Impossible III","J.J. Abrams",2006,"USA",4,3),("Mission: Impossible - The Final Reckoning","Christopher McQuarrie",2025,"USA",4,3),
 ("Jurassic World: Fallen Kingdom","J.A. Bayona",2018,"USA",4,2),("Iron Man 3","Shane Black",2013,"USA",4,3),
 ("Captain America: The First Avenger","Joe Johnston",2011,"USA",4,2),("Thor","Kenneth Branagh",2011,"USA",4,2),
 ("Guardians of the Galaxy Vol. 3","James Gunn",2023,"USA",4,3),("Spider-Man: Far From Home","Jon Watts",2019,"USA",4,2),
 ("Wonder Woman 1984","Patty Jenkins",2020,"USA",4,2),
 ("Transformers","Michael Bay",2007,"USA",4,2),("Step Brothers","Adam McKay",2008,"USA",4,3),
 ("Tropic Thunder","Ben Stiller",2008,"USA",4,3),("Knocked Up","Judd Apatow",2007,"USA",4,3),
 ("Pineapple Express","David Gordon Green",2008,"USA",4,3),("21 Jump Street","Phil Lord",2012,"USA",4,3),
 ("Game Night","John Francis Daley",2018,"USA",4,3),("Tucker and Dale vs. Evil","Eli Craig",2010,"USA",3,3),
 ("A Quiet Place: Day One","Michael Sarnoski",2024,"USA",4,3),("Terrifier 3","Damien Leone",2024,"USA",4,3),
 ("MaXXXine","Ti West",2024,"USA",3,4),("In a Violent Nature","Chris Nash",2024,"Canada",3,3),
 ("The Conjuring: The Devil Made Me Do It","Michael Chaves",2021,"USA",4,2),
 ("Annabelle: Creation","David F. Sandberg",2017,"USA",4,2),("Demon Slayer: Infinity Castle","Haruo Sotozaki",2025,"Japan",5,3),
 ("Chainsaw Man - The Movie: Reze Arc","Tatsuya Yoshihara",2025,"Japan",4,3),
 ("KPop Demon Hunters","Maggie Kang",2025,"USA",5,3),("Suzume no","",0,"",2,2),
])

# ================= SCORING / DEDUP / RANK / WAVE =================
def keyok(t,y):
    n=norm(t)
    if not n or t.endswith("no"): return False
    # keep legitimately-distinct same-title remakes
    KEEP={("metropolis",2001),("nosferatu",2024),("carrie",1976),("cure",1997),("mother",2009),
          ("scream",2022),("halloween",2018),("the killer",1989)}
    if n in excl and (n,y) not in KEEP: return False
    return n not in seen_internal

seen_internal=set(); final=[]
# de-dup internal by (norm,year); also collapse exact-title safety repeats
norm_seen={}
for (t,d,y,c,b,D,Q) in rows:
    if t.endswith("no"): continue
    n=norm(t)
    if n in excl:
        KEEP={("metropolis",2001),("nosferatu",2024),("carrie",1976),("cure",1997),("mother",2009),
              ("scream",2022),("halloween",2018),("the killer",1989)}
        if (n,y) not in KEEP: continue
    if (n,y) in seen_internal: continue
    if n in norm_seen and abs(norm_seen[n]-y)<=1: continue  # near-dup same title
    seen_internal.add((n,y)); norm_seen[n]=y
    rec_bonus = 2 if y>=2018 else (1 if y>=2010 else 0)
    graph_bonus = 1 if d in HUBS else 0
    priority = D*Q + rec_bonus + graph_bonus
    final.append({"title":t,"director":d,"year":y,"country":c,"bucket":b,"D":D,"Q":Q,
                  "priority":priority})

# sort by priority desc, then density, then year desc
final.sort(key=lambda r:(-r["priority"], -r["Q"], -r["year"], r["title"]))

# cut to 1000 keeping bucket balance target 40/33/27
TARGET={ "Canon backfill":400, "Contemporary curation":330, "Popular/genre depth":270 }
kept=[]; cnt=Counter()
overflow=[]
for r in final:
    b=r["bucket"]
    if cnt[b]<TARGET[b]:
        kept.append(r); cnt[b]+=1
    else:
        overflow.append(r)
# top up to 1000 if some bucket underfilled
i=0
while len(kept)<1000 and i<len(overflow):
    kept.append(overflow[i]); i+=1
kept=kept[:1000]
# re-sort kept by priority for ranking
kept.sort(key=lambda r:(-r["priority"], -r["Q"], -r["year"], r["title"]))
for idx,r in enumerate(kept,1):
    r["rank"]=idx
    r["wave"]= (idx-1)//250 + 1   # 4 waves of 250 by priority quartile

# export rich CSV
import csv as _csv
with open(f"{OUTDIR}/filmcurio_candidates_1000.csv","w",newline="",encoding="utf-8") as f:
    w=_csv.writer(f); w.writerow(["Rank","Wave","Bucket","Film_Title","Film_Director_Name","Year","Country","Demand","Density","Priority"])
    for r in kept:
        w.writerow([r["rank"],r["wave"],r["bucket"],r["title"],r["director"],r["year"],r["country"],r["D"],r["Q"],r["priority"]])
# import-ready 3-col
with open(f"{OUTDIR}/metatake_films_expansion_1000.csv","w",newline="",encoding="utf-8") as f:
    w=_csv.writer(f); w.writerow(["Film_TMDB_ID","Film_Title","Film_Director_Name"])
    for r in kept: w.writerow(["",r["title"],r["director"]])

print("raw pool entries:",len(rows))
print("after dedup/internal:",len(final))
print("FINAL kept:",len(kept))
print("by bucket:",dict(Counter(r["bucket"] for r in kept)))
print("by wave:",dict(sorted(Counter(r["wave"] for r in kept).items())))
print("priority range:",kept[0]["priority"],"..",kept[-1]["priority"])
print("TOP 15:")
for r in kept[:15]: print("  ",r["rank"],r["priority"],r["title"],f"({r['year']})",r["bucket"][:6])
print("dropped-as-existing examples skipped silently; overflow not used:",max(0,len(final)-1000))

