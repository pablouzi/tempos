import React, { useState, useEffect } from 'react';
import { Ingredient, RecipeItem } from '../types';
import { getIngredients, addProduct } from '../services/firebaseService';

interface AddProductFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

// Helper interface for UI display
interface RecipeItemUI extends RecipeItem {
  nombreInsumo: string;
  unidad: string;
}

const DIETARY_OPTIONS = [
  { id: 'vegan', label: 'Vegano 🌿' },
  { id: 'gluten_free', label: 'Sin Gluten 🚫🌾' },
  { id: 'sugar_free', label: 'Sin Azúcar 🚫🍬' },
  { id: 'lactose_free', label: 'Sin Lactosa 🥛' }
];

const AddProductForm: React.FC<AddProductFormProps> = ({ onSuccess, onCancel }) => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [imagenUrl, setImagenUrl] = useState('https://picsum.photos/200');
  const [descripcion, setDescripcion] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [givesStamp, setGivesStamp] = useState(true); // Default to true for coffee shop
  
  // Data for Select
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  
  // Recipe Builder State
  const [recipe, setRecipe] = useState<RecipeItemUI[]>([]);
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [amountRequired, setAmountRequired] = useState('');

  useEffect(() => {
    const fetchIns = async () => {
      try {
        const data = await getIngredients();
        setAvailableIngredients(data);
      } catch (e) {
        console.error("Error fetching ingredients for form", e);
        window.Swal.fire('Error', 'No se pudieron cargar los insumos', 'error');
      }
    };
    fetchIns();
  }, []);

  const handleTagChange = (tagId: string) => {
    setTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId) 
        : [...prev, tagId]
    );
  };

  const handleAddIngredient = () => {
    if (!selectedIngredientId || !amountRequired) {
      window.Swal.fire('Atención', 'Selecciona un insumo e ingresa la cantidad', 'warning');
      return;
    }

    const qty = parseFloat(amountRequired);
    if (isNaN(qty) || qty <= 0) {
      window.Swal.fire('Error', 'La cantidad debe ser mayor a 0', 'error');
      return;
    }

    const ingredientData = availableIngredients.find(i => i.id === selectedIngredientId);
    if (!ingredientData) return;

    // Check if already in recipe
    if (recipe.some(r => r.idInsumo === selectedIngredientId)) {
       window.Swal.fire('Ya existe', 'Este insumo ya está en la receta', 'info');
       return;
    }

    const newItem: RecipeItemUI = {
      idInsumo: selectedIngredientId,
      cantidadRequerida: qty,
      nombreInsumo: ingredientData.nombre,
      unidad: ingredientData.unidad
    };

    setRecipe([...recipe, newItem]);
    // Reset selection
    setSelectedIngredientId('');
    setAmountRequired('');
  };

  const removeIngredient = (id: string) => {
    setRecipe(recipe.filter(r => r.idInsumo !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nombre || !precio || !imagenUrl) {
      window.Swal.fire('Campos incompletos', 'Por favor llena Nombre, Precio e Imagen', 'warning');
      return;
    }

    const priceNum = parseFloat(precio);
    if (isNaN(priceNum) || priceNum <= 0) {
        window.Swal.fire('Error', 'Precio inválido', 'error');
        return;
    }

    if (recipe.length === 0) {
        window.Swal.fire('Receta vacía', 'Debes agregar al menos un insumo a la receta', 'warning');
        return;
    }

    // Prepare for DB (remove UI helper fields)
    const cleanRecipe: RecipeItem[] = recipe.map(({ idInsumo, cantidadRequerida }) => ({
        idInsumo,
        cantidadRequerida
    }));

    try {
        await addProduct({
            nombre,
            precio: priceNum,
            imagen_url: imagenUrl,
            receta: cleanRecipe,
            tags: tags,
            descripcion: descripcion.trim(),
            givesStamp: givesStamp
        });
        
        window.Swal.fire('Éxito', 'Producto creado correctamente', 'success');
        onSuccess();
    } catch (e: any) {
        window.Swal.fire('Error', 'No se pudo guardar el producto: ' + e.message, 'error');
    }
  };

  return (
    <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-coffee-800 mb-6">Crear Nuevo Producto</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Nombre del Producto</label>
                <input 
                    type="text" 
                    value={nombre} 
                    onChange={e => setNombre(e.target.value)}
                    className="mt-1 block w-full bg-gray-50 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500 text-gray-900"
                    placeholder="Ej: Capuchino"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700">Precio (CLP)</label>
                <input 
                    type="number" 
                    step="10"
                    value={precio} 
                    onChange={e => setPrecio(e.target.value)}
                    className="mt-1 block w-full bg-gray-50 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500 text-gray-900"
                    placeholder="Ej: 2500"
                />
            </div>
        </div>

        {/* Loyalty Checkbox */}
        <div className="flex items-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <input
                id="givesStamp"
                type="checkbox"
                checked={givesStamp}
                onChange={e => setGivesStamp(e.target.checked)}
                className="h-5 w-5 text-coffee-600 focus:ring-coffee-500 border-gray-300 rounded cursor-pointer"
            />
            <label htmlFor="givesStamp" className="ml-3 block text-sm font-bold text-coffee-900 cursor-pointer">
                🏅 Acumula Sello para Meta (10 sellos = 1 Gratis)
            </label>
        </div>

        {/* Description & Tags */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700">Descripción Corta</label>
                <textarea 
                    rows={3}
                    value={descripcion} 
                    onChange={e => setDescripcion(e.target.value)}
                    className="mt-1 block w-full bg-gray-50 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500 text-sm text-gray-900"
                    placeholder="Ej: Con leche de almendras y canela..."
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas Dietéticas</label>
                <div className="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-200">
                    {DIETARY_OPTIONS.map(option => (
                        <div key={option.id} className="flex items-center">
                            <input
                                id={`tag-${option.id}`}
                                type="checkbox"
                                checked={tags.includes(option.id)}
                                onChange={() => handleTagChange(option.id)}
                                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                            />
                            <label htmlFor={`tag-${option.id}`} className="ml-2 block text-sm text-gray-900 cursor-pointer">
                                {option.label}
                            </label>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        <div>
            <label className="block text-sm font-medium text-gray-700">URL Imagen</label>
            <input 
                type="text" 
                value={imagenUrl} 
                onChange={e => setImagenUrl(e.target.value)}
                className="mt-1 block w-full bg-gray-50 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500 text-gray-900"
                placeholder="https://..."
            />
            {imagenUrl && (
                <div className="mt-2 h-20 w-20 bg-gray-100 rounded overflow-hidden">
                    <img src={imagenUrl} alt="Preview" className="h-full w-full object-cover" />
                </div>
            )}
        </div>

        <hr className="border-gray-200" />

        {/* Recipe Builder */}
        <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Receta (Descuento de Inventario)</h3>
            
            <div className="flex gap-2 items-end mb-4 bg-gray-50 p-4 rounded-md border border-gray-200">
                <div className="flex-grow">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Insumo</label>
                    <select
                        value={selectedIngredientId}
                        onChange={e => setSelectedIngredientId(e.target.value)}
                        className="block w-full bg-white text-gray-900 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500"
                    >
                        <option value="" className="text-gray-400">-- Seleccionar Insumo --</option>
                        {availableIngredients.map(ing => (
                            <option key={ing.id} value={ing.id}>{ing.nombre} ({ing.unidad})</option>
                        ))}
                    </select>
                </div>
                <div className="w-24">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Cantidad</label>
                    <input 
                        type="number" 
                        value={amountRequired}
                        onChange={e => setAmountRequired(e.target.value)}
                        className="block w-full bg-white text-gray-900 rounded-md border-gray-300 shadow-sm border p-2 focus:border-coffee-500 focus:ring-coffee-500"
                        placeholder="0"
                    />
                </div>
                <button 
                    type="button"
                    onClick={handleAddIngredient}
                    className="bg-coffee-600 text-white px-4 py-2 rounded-md hover:bg-coffee-700 transition-colors shadow-sm"
                >
                    Agregar
                </button>
            </div>

            {/* Recipe List */}
            <div className="bg-white border rounded-md overflow-hidden">
                {recipe.length === 0 ? (
                    <p className="text-gray-400 text-sm p-4 text-center italic">No hay ingredientes agregados a la receta aún.</p>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Insumo</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cantidad</th>
                                <th className="px-4 py-2"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {recipe.map((item, idx) => (
                                <tr key={idx}>
                                    <td className="px-4 py-2 text-sm text-gray-900">{item.nombreInsumo}</td>
                                    <td className="px-4 py-2 text-sm text-gray-500">{item.cantidadRequerida} {item.unidad}</td>
                                    <td className="px-4 py-2 text-right">
                                        <button 
                                            type="button"
                                            onClick={() => removeIngredient(item.idInsumo)}
                                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                                        >
                                            Eliminar
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button 
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
                Cancelar
            </button>
            <button 
                type="submit"
                className="px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
                Guardar Producto
            </button>
        </div>
      </form>
    </div>
  );
};

export default AddProductForm;