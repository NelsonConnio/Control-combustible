// Asegúrate de que la constante 'supabase' está definida en tu index.html.

// Referencias del DOM
const form = document.getElementById('task-form');
// taskKmInput corresponde al campo Km (que se guarda en la columna 'task_name' de Supabase)
const taskKmInput = document.getElementById('task-km'); 
const taskDateInput = document.getElementById('task-date');
const taskListBody = document.getElementById('task-list-body');

// Campos de Combustible
const taskLitersInput = document.getElementById('task-liters'); 
const taskPriceInput = document.getElementById('task-price'); 

// Vistas y Navegación
const navButtons = document.querySelectorAll('.nav-button');
const contentViews = document.querySelectorAll('.content-view');

const TABLE_NAME = 'TABLE_NAME'; // Nombre de tu tabla en Supabase
const ROWS_TO_SHOW = 50; // Total de registros a mostrar
const ROWS_TO_EDIT = 5;  // Cantidad de registros editables (los más recientes)

let currentlyEditingId = null;

// ----------------------------------------------------------------
// FUNCIÓN: ESTABLECER FECHA ACTUAL DE LA MÁQUINA
// ----------------------------------------------------------------
function setTodayDate() {
    const today = new Date();
    // Formato YYYY-MM-DD necesario para el input[type="date"]
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    if(taskDateInput) {
        taskDateInput.value = `${year}-${month}-${day}`;
    }
}


// ----------------------------------------------------------------
// GESTIÓN DE VISTAS (NAVEGACIÓN)
// ----------------------------------------------------------------

function showView(viewId, buttonId) {
    // 1. Ocultar todas las vistas y desactivar todos los botones
    contentViews.forEach(view => {
        view.classList.remove('active');
    });
    navButtons.forEach(button => {
        button.classList.remove('active');
    });

    // 2. Mostrar la vista seleccionada y activar el botón
    const selectedView = document.getElementById(viewId);
    const selectedButton = document.getElementById(buttonId);

    if (selectedView) {
        selectedView.classList.add('active');
    }
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    
    // Si la vista es Histórico, recargar los datos
    if (viewId === 'view-historico') {
        loadAndProcessData();
    }
    // Si es la vista de carga, asegurar que la fecha esté actualizada
    if (viewId === 'view-carga') {
        setTodayDate();
    }
}

// Asignar listeners a los botones del panel
document.getElementById('nav-carga').addEventListener('click', () => {
    showView('view-carga', 'nav-carga');
});
document.getElementById('nav-historico').addEventListener('click', () => {
    showView('view-historico', 'nav-historico');
});
document.getElementById('nav-graficas').addEventListener('click', () => {
    showView('view-graficas', 'nav-graficas');
});


// ----------------------------------------------------------------
// FUNCIÓN PRINCIPAL: CARGAR Y PROCESAR DATOS (ÚLTIMOS 50)
// ----------------------------------------------------------------

async function loadAndProcessData() {
    try {
        // task_name en Supabase corresponde a Km en la UI
        const { data, error } = await supabase
            .from(TABLE_NAME)
            .select('id, created_at, task_date, task_name, litros, precio') 
            .order('created_at', { ascending: false }) // Los más recientes primero
            .limit(ROWS_TO_SHOW); // Limita a los últimos 50

        if (error) throw error;

        updateUI(data); // Llama a la función para pintar la lista
    } catch (error) {
        console.error("Error al cargar datos de Supabase:", error.message);
        taskListBody.innerHTML = '<tr><td colspan="6">Error al cargar el histórico. Verifica tus claves de Supabase.</td></tr>';
    }
}


// ----------------------------------------------------------------
// FUNCIÓN PARA PINTAR LA INTERFAZ DE USUARIO (HISTÓRICO)
// ----------------------------------------------------------------

function updateUI(data) {
    taskListBody.innerHTML = ''; // Limpia el contenido anterior

    data.forEach((entry, index) => {
        const isEditable = index < ROWS_TO_EDIT; // Los primeros 5 son editables
        const row = taskListBody.insertRow();
        row.setAttribute('data-id', entry.id);

        // Calcula el costo total y formatea los decimales
        const totalCost = (entry.litros * entry.precio).toFixed(2);
        const litrosDisplay = entry.litros !== null && entry.litros !== undefined ? parseFloat(entry.litros).toFixed(3) : '0.000';
        const precioDisplay = entry.precio !== null && entry.precio !== undefined ? parseFloat(entry.precio).toFixed(3) : '0.000';
        const kmDisplay = entry.task_name || '-'; // task_name es el campo Km

        row.innerHTML = `
            <td><span class="field" data-column="task_date">${entry.task_date || '-'}</span></td>
            <td><span class="field" data-column="task_name">${kmDisplay}</span></td>
            <td><span class="field" data-column="litros">${litrosDisplay}</span></td>
            <td><span class="field" data-column="precio">${precioDisplay}</span></td>
            <td>$${totalCost}</td>
            <td class="actions-cell">
                ${isEditable ? 
                    // Botones de acción visibles para los últimos 5
                    `<button class="btn-edit" data-id="${entry.id}">✏️ Editar</button>
                     <button class="btn-delete" data-id="${entry.id}">🗑️ Eliminar</button>`
                    : 
                    `<span class="no-actions">Solo Lectura</span>` // Texto para el resto de registros
                }
            </td>
        `;
    });
    
    attachActionListeners(); 
}


// ----------------------------------------------------------------
// ASIGNAR LISTENERS Y MANEJO DE ELIMINACIÓN
// ----------------------------------------------------------------

function attachActionListeners() {
    document.querySelectorAll('.btn-edit').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            toggleEditMode(id); 
        });
    });
    
    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm(`¿Estás seguro de que deseas eliminar el registro ID ${id}? Esta acción es irreversible.`)) {
                deleteEntry(id);
            }
        });
    });
}

async function deleteEntry(id) {
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log(`Registro ID ${id} eliminado con éxito.`);
        loadAndProcessData(); // Recargar la tabla
    } catch (error) {
        console.error("Error al eliminar el registro: ", error.message);
        alert("Error al eliminar el registro. Revisa la consola.");
    }
}

// ----------------------------------------------------------------
// EDICIÓN EN LÍNEA (TOGGLE Y GUARDADO)
// ----------------------------------------------------------------

function toggleEditMode(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    if (!row) return;

    if (currentlyEditingId && currentlyEditingId != id) {
        alert("Por favor, guarda o cancela la edición del registro actual.");
        return; 
    }
    
    if (row.classList.contains('editing')) {
        exitEditMode(id, row, true);
        return;
    }

    // --- ENTRAMOS EN MODO EDICIÓN ---
    currentlyEditingId = id;
    row.classList.add('editing');

    const editableFields = row.querySelectorAll('.field');
    const actionsCell = row.querySelector('.actions-cell');

    editableFields.forEach(span => {
        const column = span.getAttribute('data-column');
        const currentValue = span.textContent.trim().replace('$', ''); 
        let inputType = 'text';
        
        if (column === 'task_date') {
            inputType = 'date';
        } else if (column === 'litros' || column === 'precio' || column === 'task_name') {
            // task_name (Km) y los campos numéricos deben ser editados con input type="number"
            inputType = 'number';
        }

        const input = document.createElement('input');
        input.setAttribute('type', inputType);
        input.setAttribute('value', currentValue);
        input.setAttribute('data-column', column);
        input.setAttribute('required', 'true');
        
        if (inputType === 'number') input.setAttribute('step', '0.001');

        span.parentNode.replaceChild(input, span);
    });
    
    // Cambiar botones a Guardar y Cancelar
    actionsCell.innerHTML = `
        <button class="btn-save-edit" data-id="${id}">💾 Guardar</button>
        <button class="btn-cancel-edit" data-id="${id}">❌ Cancelar</button>
    `;
    
    actionsCell.querySelector('.btn-save-edit').addEventListener('click', () => saveEdit(id));
    actionsCell.querySelector('.btn-cancel-edit').addEventListener('click', () => exitEditMode(id, row, true));
}

function exitEditMode(id, row, cancel = false) {
    currentlyEditingId = null;
    row.classList.remove('editing');
    
    if (cancel) {
        loadAndProcessData(); 
    }
}

async function saveEdit(id) {
    const row = document.querySelector(`tr[data-id="${id}"]`);
    const inputs = row.querySelectorAll('input');
    const updatedData = {};
    let allValid = true;

    inputs.forEach(input => {
        const column = input.getAttribute('data-column');
        let value = input.value;
        
        if (column === 'litros' || column === 'precio') {
            value = Math.round(parseFloat(value) * 1000) / 1000;
            if (isNaN(value) || value <= 0) { 
                alert(`El campo ${column} debe ser un número positivo.`);
                allValid = false;
            }
        } else if (column === 'task_name') {
             // Validación simple para Km
            value = parseInt(value);
            if (isNaN(value) || value < 0) {
                 alert(`El campo Km debe ser un número entero no negativo.`);
                allValid = false;
            }
        }
        updatedData[column] = value;
    });

    if (!allValid) return; 
    
    try {
        const { error } = await supabase
            .from(TABLE_NAME)
            .update(updatedData)
            .eq('id', id);

        if (error) throw error;

        console.log(`Registro ID ${id} actualizado con éxito.`);
        
        exitEditMode(id, row, false); 
        loadAndProcessData();

    } catch (error) {
        console.error("Error al actualizar el registro: ", error.message);
        alert("Error al actualizar el registro. Revisa la consola.");
    }
}


// ----------------------------------------------------------------
// MANEJO DE ENVÍO DE FORMULARIO
// ----------------------------------------------------------------

form.addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Redondeo de valores a 3 decimales antes de guardar
        const liters = Math.round(parseFloat(taskLitersInput.value) * 1000) / 1000;
        const price = Math.round(parseFloat(taskPriceInput.value) * 1000) / 1000;
        
        const newEntry = {
            // taskKmInput corresponde a task_name en la base de datos
            task_name: taskKmInput.value, 
            task_date: taskDateInput.value,
            litros: liters,
            precio: price
        };
        
        const { error } = await supabase.from(TABLE_NAME).insert([newEntry]); 

        if (error) throw error;
        
        console.log("Carga registrada con éxito en Supabase.");
        
        form.reset();
        setTodayDate(); // Vuelve a establecer la fecha de la máquina
        taskKmInput.focus();
        // Si el usuario estaba en histórico, recargar para mostrar el nuevo registro
        if (document.getElementById('view-historico').classList.contains('active')) {
             loadAndProcessData();
        }

    } catch (error) {
        console.error("Error al guardar la carga: ", error.message);
        alert("Error al guardar la carga. Revisa la consola.");
    }
});


// ----------------------------------------------------------------
// INICIO: Carga el Histórico y establece la fecha de la máquina
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    setTodayDate(); // 1. Establece la fecha actual en el campo de carga
    // 2. Muestra el Histórico por defecto (y carga los datos)
    showView('view-historico', 'nav-historico'); 
});

