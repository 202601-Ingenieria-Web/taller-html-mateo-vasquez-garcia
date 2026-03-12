const pokemonGrid = document.getElementById('pokemon-grid');
const loading = document.getElementById('loading');
const searchInput = document.getElementById('input-search');
const btnPrev = document.getElementById('button-prev');
const btnNext = document.getElementById('button-next');
const modalOverlay = document.getElementById('modal-pokemon');
const closeModalBtn = document.getElementById('close-modal');
const modalContent = document.getElementById('modal-content');

let paginaActual = 0;
const limite = 24; //de modo que organicemos un maximo de 24 pokemons por pagina, es decir 6 lineas de 4 pokemons cada una
let listaPokemons = [];  // lista de la página actual (24 pokemon)
let listaCompleta = [];  // lista completa usada para buscar en todos los pokemon, esto lo hago para evitar 
// problemas con la búsqueda al tener solo acceso a los pokemon de la página actual, lo que hacia que si un 
// término de búsqueda no estaba en esa página, no se mostrara ningún resultado aunque existiera en otra página
// ademas de permitir la busqueda parcial por nombre, ejemplo si busco "dra", me apareceran filtrados todos los 
// pokemons que contienen "dra", como por ejemplo DRAgapult, RegiDRAgo, DRAcozolt, entre otros
let busqueda = false;
let resultadosBusqueda = []; // todos los resultados del filtro actual, esto lo hago dado que un problema que 
// encontre es que si un termino de busqueda contaba con mas de 24 pokemons no se podian visualizar todos.
let paginaBusqueda = 0;    // offset dentro de resultadosBusqueda

// Carga inicial
async function inicializar() {
    await cargarPokemons(paginaActual, limite);

    try{
        // Primero obtenemos el total real de pokemon que tiene la API
        const countRes = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1');
        const countData = await countRes.json();
        const total = countData.count;

        // Luego traemos todos con el total exacto para no perdernos ninguno
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=0&limit=${total}`);
        const data = await res.json();
        // Guardamos en listaCompleta para que la búsqueda siempre tenga acceso a todos los pokemon
        listaCompleta = data.results;
    }catch (e){
        console.error('Error al cargar la lista completa de pokemons:', e);
    }
}

async function cargarPokemons(offset, limit) {
    try{
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=${limit}`);
        const data = await res.json();
        listaPokemons = data.results;
        
        //actualizamos botones de paginado
        btnPrev.disabled = offset === 0;
        btnNext.disabled = data.next === null;

        mostrarPokemons(listaPokemons);
    }
    catch(error){
        console.error('Error al cargar los pokemons:', error);
        pokemonGrid.innerHTML = '<p>Error al cargar los pokemons. Por favor, inténtalo de nuevo más tarde.</p>';
    }
}

async function mostrarPokemons(listaPokemons) {
    pokemonGrid.innerHTML = '';
    // Mostramos el grid (puede estar oculto al inicio)
    pokemonGrid.classList.remove('hidden');

    const promises = listaPokemons.map(p => fetch(p.url).then(res => res.json()));
    const pokemonDetails = await Promise.all(promises);

    // Filtramos los pokemon que no tienen ningún sprite disponible (formas sin artwork como
    // garchomp-mega-z, magearna-original, tatsugiri-curly-mega, etc.) para no mostrar cartas vacías
    // esto lo hago mas que nada porque los pokemons que identifique sin sprite, eran versiones de otro que si tiene sprite
    // un ejemplo de esto es el tatsugiri stretchy-mega, que si tiene sprite pero el curly o el droopy no
    // apesar de compartir stats y demas, por lo que decidi no mostrarlos para evitar cargas inecesarias y que no queden completamente bien
    const pokemonsConSprite = pokemonDetails.filter(pokemon => {
        const artworkUrl = pokemon.sprites.other?.['official-artwork']?.front_default;
        const spriteUrl = pokemon.sprites.front_default;
        return artworkUrl || spriteUrl;
    });

    pokemonsConSprite.forEach(pokemon => {
        const card = cartaPokemon(pokemon);
        pokemonGrid.appendChild(card);
    });
}

function cartaPokemon(pokemon) {
    const card = document.createElement('div');
    card.classList.add('pokemon-card');
    // Usamos el ID de la especie (extraído de species.url) para mostrar el número correcto
    // aqui tuve unn problemita que logre solucionar y es que pokemons con varias verciones tenian distinto ID o numero de pokedex, por lo que se hizo el ajuste a species.url
    const speciesId = parseInt(pokemon.species.url.split('/').slice(-2, -1)[0]);
    const id = speciesId.toString().padStart(3, '0');
    const tipoPrincipal = pokemon.types[0].type.name;
    const imgUrl = pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default; //algunos pokemons no tienen artwork oficial, asi que usamos el sprite normal como fallback
    //Para que se vea mejor, vamos a darle al CSS el color dependiendo del tipo
    card.style.setProperty('--type-color', `var(--type-${tipoPrincipal})`);
    let typesHtml = '';
    pokemon.types.forEach(t => {
        typesHtml += `<span class="type-badge" style="--type-color: var(--type-${t.type.name})">${t.type.name}</span>`;
    });

    card.innerHTML = `
        <span class="pokemon-id">#${id}</span>
        <div class="pokemon-img-container">
            <img src="${imgUrl}" alt="${pokemon.name}" class="pokemon-img" loading="lazy">
        </div>
        <h3 class="pokemon-name">${pokemon.name.replace('-', ' ')}</h3>
        <div class="pokemon-types">${typesHtml}</div>
    `;

    card.addEventListener('click', () => verDetallesPokemon(pokemon));

    return card;
}

// Función para aplicar la Busqueda
searchInput.addEventListener('input', async(e) =>{
    const termino = e.target.value.toLowerCase();
    if(termino === '' || termino.length === 0){
        if (busqueda){
            busqueda = false;
            document.querySelector('.pagination').style.display = 'flex';
            // Recargamos la página actual al limpiar la búsqueda
            await cargarPokemons(paginaActual, limite);
        }
        return;
    }

    busqueda = true;
    paginaBusqueda = 0; // reiniciamos a la primera página cada vez que cambia el término

    // Buscamos en listaCompleta para encontrar pokemon de cualquier página.
    // Para búsquedas numéricas usamos igualdad exacta contra el ID de la URL,
    const esNumero = /^\d+$/.test(termino);
    resultadosBusqueda = listaCompleta.filter(p => {
        const urlId = p.url.split('/').slice(-2, -1)[0];
        if (esNumero) {
            return p.name.includes(termino) || urlId === termino;
        }
        return p.name.includes(termino);
    });

    mostrarPaginaBusqueda();
});

// Muestra la página actual de resultados de búsqueda y actualiza los botones
function mostrarPaginaBusqueda() {
    if (resultadosBusqueda.length === 0) {
        pokemonGrid.innerHTML = '<p>No se encontraron pokemons que coincidan con tu búsqueda.</p>';
        document.querySelector('.pagination').style.display = 'none';
        return;
    }

    const pagina = resultadosBusqueda.slice(paginaBusqueda, paginaBusqueda + limite);
    mostrarPokemons(pagina);

    // Reutilizamos los botones de paginado mostrando/ocultando según haya más páginas
    btnPrev.disabled = paginaBusqueda === 0;
    btnNext.disabled = paginaBusqueda + limite >= resultadosBusqueda.length;
    document.querySelector('.pagination').style.display = 'flex';
}

// Botones de paginado
btnNext.addEventListener('click', () => {
    if (busqueda) {
        paginaBusqueda += limite;
        mostrarPaginaBusqueda();
    } else {
        paginaActual += limite; // avanzamos al siguiente bloque
        cargarPokemons(paginaActual, limite);
    }
});

btnPrev.addEventListener('click', () => {
    if (busqueda) {
        if (paginaBusqueda >= limite) {
            paginaBusqueda -= limite;
            mostrarPaginaBusqueda();
        }
    } else {
        if (paginaActual >= limite) {
            paginaActual -= limite; // retrocedemos al bloque anterior
            cargarPokemons(paginaActual, limite);
        }
    }
});

//Boton de cerrar modal
closeModalBtn.addEventListener('click', () => {
    modalOverlay.classList.add('hidden');
    document.body.style.overflow = '';
});

// o que tambien cierre el modal al hacer click fuera del contenido
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
        modalOverlay.classList.add('hidden');
        document.body.style.overflow = '';
    }
});


//Modal de detalles del pokemon
function verDetallesPokemon(pokemon) {
    // Igual que en la carta, usamos el ID de la especie para el número de Pokédex correcto
    const speciesId = parseInt(pokemon.species.url.split('/').slice(-2, -1)[0]);
    const id = speciesId.toString().padStart(3, '0');
    const tipoPrincipal = pokemon.types[0].type.name;
    const tipoSecundario = pokemon.types[1] ? pokemon.types[1].type.name : null;
    const imgUrl = pokemon.sprites.other['official-artwork'].front_default || pokemon.sprites.front_default;
    let typesHtml = '';

    const height = (pokemon.height / 10).toFixed(1);
    const weight = (pokemon.weight / 10).toFixed(1);

    // Fondo del header: sólido para un tipo, degradado radial para dos tipos
    const headerBg = tipoSecundario
        ? `radial-gradient(circle at top right, var(--type-${tipoPrincipal}) 0%, transparent 80%), radial-gradient(circle at bottom left, var(--type-${tipoSecundario}) 0%, transparent 60%)`
        : `var(--type-${tipoPrincipal})`;

    pokemon.types.forEach(t => {
        typesHtml += `<span class="type-badge" style="--type-color: var(--type-${t.type.name})">${t.type.name}</span>`;
    });

    let statsHtml = '';
    pokemon.stats.forEach(s => {
        // Escalamos sobre 255 (el máximo posible de cualquier stat) para que la barra sea proporcional
        const width = ((s.base_stat / 255) * 100).toFixed(1);
        let statName = s.stat.name;
        if(statName === 'hp') statName = 'HP';
        else if(statName === 'attack') statName = 'Attack';
        else if(statName === 'defense') statName = 'Defense';
        else if(statName === 'special-attack') statName = 'Sp. Atk';
        else if(statName === 'special-defense') statName = 'Sp. Def';
        else if(statName === 'speed') statName = 'Speed';

        statsHtml += `
            <div class="stat-row">
                <span class="stat-name">${statName.replace('-', ' ')}</span>
                <span class="stat-value">${s.base_stat}</span>
                <div class="stat-bar-bg">
                    <div class="stat-bar-fill" style="width: ${width}%; --type-color-1: var(--type-${tipoPrincipal});"></div>
                </div>
            </div>
        `;
    })

    modalContent.innerHTML = `
        <div class="modal-header" style="background: ${headerBg}; --type-color-1: var(--type-${tipoPrincipal});">
            <h2 class="pokemon-name" style="font-size: 2rem; margin-bottom: 0;">${pokemon.name.replace('-', ' ')} <span class="pokemon-id" style="position:relative; right:0; top:0; font-size:1.5rem; opacity:0.8; margin-left: 10px;">#${id}</span></h2>
            <div class="modal-img-wrapper">
                <img src="${imgUrl}" alt="${pokemon.name}" class="modal-img">
            </div>
        </div>
        <div class="modal-body">
            <div class="pokemon-types" style="margin-top: 1rem; margin-bottom: 0;">
                ${typesHtml}
            </div>
            
            <div class="measurements">
                <div>
                    <div class="measure-label">Altura</div>
                    <div class="measure-val">${height} m</div>
                </div>
                <div>
                    <div class="measure-label">Peso</div>
                    <div class="measure-val">${weight} kg</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 1rem; font-size: 1.2rem; text-align:center; color: var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Estadísticas Base</h3>
            <div class="stats-container">
                ${statsHtml}
            </div>
        </div>
    `;
    
    modalOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

}


inicializar();