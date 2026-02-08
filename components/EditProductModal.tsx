import React, { useState, useEffect } from 'react';
import { Product, Ingredient, RecipeItem } from '../types';
import { getIngredients, updateProduct } from '../services/firebaseService';

interface EditProductModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

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

const SUGGESTED_CATEGORIES = ['Cafetería', 'Pastelería', 'Bebidas Frías', 'Sandwiches', 'Otros'];

const EditProductModal: React.FC<EditProductModalProps> = ({ product, isOpen, onClose, onSuccess }) => {
  const [nombre, setNombre] = useState('');
  const [precio, setPrecio] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [category, setCategory] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [givesStamp, setGivesStamp] = useState(false);
  
  const [availableIngredients, setAvailableIngredients] = useState<Ingredient[]>([]);
  const [recipe, setRecipe] = useState<RecipeItemUI[]>([]);
  
  // Controls for adding ingredients
  const [selectedIngredientId, setSelectedIngredientId] = useState('');
  const [amountRequired, setAmountRequired] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Load initial data when product changes or modal opens
  useEffect(() => {
    if (isOpen && product) {
      setNombre(product.nombre);
      setPrecio(product.precio.toString());
      setImagenUrl(product.imagen_url);
      setCategory(product.category || 'Otros');
      setDescripcion(product.descripcion || '');
      setTags(product.tags || []);
      setGivesStamp(product.givesStamp || false);
      
      const loadDependencies = async () => {
        try {
            const ingredientsData = await getIngredients();
            setAvailableIngredients(ingredientsData);
            
            // Map existing recipe to UI model
            const mappedRecipe: RecipeItemUI[] = (product.receta || []).map(rItem => {
                const ing = ingredientsData.find(i => i.id === rItem.idInsumo);
                return {
                    idInsumo: rItem.idInsumo,
                    cantidadRequerida: rItem.cantidadRequerida,
                    nombreInsumo: ing ? ing.nombre : 'Insumo Desconocido',
                    unidad: ing ? ing.unidad : '?'
                };
            });
            setRecipe(mappedRecipe);
        } catch (e) {
            console.error(e);
            window.Swal.fire('Error', 'Error cargando datos de insumos', 'error');
        }
      };
      loadDependencies();
    }
  }, [product, isOpen]);

  const handleTagChange = (tagId: string) => {
    setTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(t => t !== tagId) 
        : [...prev, tagId]
    );
  };

  const handleAddIngredient = () => {
    if (!selectedIngredientId || !amountRequired) return;

    const qty = parseFloat(amountRequired);
    if (isNaN(qty) || qty <= 0) return;

    const ingredientData = availableIngredients.find(i => i.id === selectedIngredientId);
    if (!ingredientData) return;

    if (recipe.some(r => r.idInsumo === selectedIngredientId)) {
       window.Swal.fire('Ya existe', 'Este insumo ya está en la receta', 'info');
       return;
    }

    setRecipe([...recipe, {
      idInsumo: selectedIngredientId,
      cantidadRequerida: qty,
      nombreInsumo: ingredientData.nombre,
      unidad: ingredientData.unidad
    }]);

    setSelectedIngredientId('');
    setAmountRequired('');
  };

  const removeIngredient = (id: string) => {
    setRecipe(recipe.filter(r => r.idInsumo !== id));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product.id) return;

    setIsLoading(true);
    try {
        const cleanRecipe: RecipeItem[] = recipe.map(({ idInsumo, cantidadRequerida }) => ({
            idInsumo,
            cantidadRequerida
        }));

        await updateProduct(product.id, {
            nombre,
            precio: parseFloat(precio),
            imagen_url: imagenUrl,
            category: category,
            descripcion: descripcion.trim(),
            tags: tags,
            receta: cleanRecipe,
            givesStamp: givesStamp
        });

        window.Swal.fire('Guardado', 'Producto actualizado', 'success');
        onSuccess();
    } catch (e: any) {
        window.Swal.fire('Error', 'Fallo al actualizar: ' + e.message, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} aria-hidden="true"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Editar Producto</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>

                <form onSubmit={handleSave} className="space-y-4">
                    {/* Info */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre</label>
                        <input 
                            type="text" 
                            className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Precio (CLP)</label>
                            <input 
                                type="number" 
                                step="10"
                                className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                                value={precio}
                                onChange={e => setPrecio(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Categoría</label>
                            <input
                                list="category-suggestions-edit"
                                className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                            />
                            <datalist id="category-suggestions-edit">
                                {SUGGESTED_CATEGORIES.map(c => <option key={c} value={c} />)}
                            </datalist>
                        </div>
                    </div>

                    {/* Loyalty Checkbox */}
                    <div className="flex items-center p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                        <input
                            id="edit-givesStamp"
                            type="checkbox"
                            checked={givesStamp}
                            onChange={e => setGivesStamp(e.target.checked)}
                            className="h-4 w-4 text-coffee-600 focus:ring-coffee-500 border-gray-300 rounded cursor-pointer"
                        />
                        <label htmlFor="edit-givesStamp" className="ml-2 block text-sm font-bold text-coffee-900 cursor-pointer">
                            🏅 Acumula Sello
                        </label>
                    </div>
                    
                    {/* Tags & Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                        <textarea 
                            rows={2}
                            className="block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 text-sm text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                            value={descripcion}
                            onChange={e => setDescripcion(e.target.value)}
                            placeholder="Descripción corta..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Etiquetas</label>
                        <div className="grid grid-cols-2 gap-2 bg-gray-50 p-2 rounded border border-gray-200">
                            {DIETARY_OPTIONS.map(option => (
                                <div key={option.id} className="flex items-center">
                                    <input
                                        id={`edit-tag-${option.id}`}
                                        type="checkbox"
                                        checked={tags.includes(option.id)}
                                        onChange={() => handleTagChange(option.id)}
                                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded cursor-pointer"
                                    />
                                    <label htmlFor={`edit-tag-${option.id}`} className="ml-2 block text-xs text-gray-900 cursor-pointer">
                                        {option.label}
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700">Imagen URL</label>
                        <input 
                            type="text" 
                            className="mt-1 block w-full bg-gray-50 border border-gray-300 rounded-md shadow-sm p-2 text-xs text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                            value={imagenUrl}
                            onChange={e => setImagenUrl(e.target.value)}
                        />
                    </div>

                    <div className="border-t border-gray-200 pt-4">
                        <h4 className="font-bold text-coffee-700 mb-2">Receta</h4>
                        {/* Add Ingredient Mini Form */}
                        <div className="flex gap-2 mb-2 bg-gray-50 p-2 rounded">
                             <select
                                value={selectedIngredientId}
                                onChange={e => setSelectedIngredientId(e.target.value)}
                                className="block w-full text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                            >
                                <option value="">+ Insumo</option>
                                {availableIngredients.map(ing => (
                                    <option key={ing.id} value={ing.id}>{ing.nombre}</option>
                                ))}
                            </select>
                            <input 
                                type="number"
                                placeholder="Cant."
                                className="w-20 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-coffee-500 focus:border-coffee-500"
                                value={amountRequired}
                                onChange={e => setAmountRequired(e.target.value)}
                            />
                            <button 
                                type="button"
                                onClick={handleAddIngredient}
                                className="bg-coffee-600 text-white px-3 rounded hover:bg-coffee-700 text-sm"
                            >
                                +
                            </button>
                        </div>

                        {/* List */}
                        <ul className="divide-y divide-gray-100">
                            {recipe.map((r, idx) => (
                                <li key={idx} className="py-2 flex justify-between items-center text-sm">
                                    <span>{r.nombreInsumo}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono bg-gray-100 px-2 rounded">{r.cantidadRequerida} {r.unidad}</span>
                                        <button 
                                            type="button" 
                                            onClick={() => removeIngredient(r.idInsumo)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                            </svg>
                                        </button>
                                    </div>
                                </li>
                            ))}
                            {recipe.length === 0 && <li className="text-gray-400 text-xs italic">Sin ingredientes.</li>}
                        </ul>
                    </div>

                    <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse border-t border-gray-200 -mx-6 -mb-4">
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            {isLoading ? 'Guardando...' : 'Guardar Cambios'}
                        </button>
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default EditProductModal;