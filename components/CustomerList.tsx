import React, { useEffect, useState } from 'react';
import { Customer } from '../types';
import { getCustomers, deleteCustomer, updateCustomer, batchImportCustomers } from '../services/firebaseService';

const CustomerList: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // --- Import Modal State ---
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  // --- Edit Modal State ---
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error: any) {
      console.error("Error fetching customers:", error);
      window.Swal.fire('Error', 'No se pudieron cargar los clientes', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Nunca';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('es-CL', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return 'Fecha inválida';
    }
  };

  // --- Delete Handler ---
  const handleDelete = async (id: string) => {
    const result = await window.Swal.fire({
      title: '¿Eliminar Cliente?',
      text: "Se perderán sus sellos acumulados. Esta acción no se puede deshacer.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Sí, borrar'
    });

    if (result.isConfirmed) {
      try {
        await deleteCustomer(id);
        window.Swal.fire('Eliminado', 'Cliente eliminado correctamente', 'success');
        fetchCustomers();
      } catch (e: any) {
        window.Swal.fire('Error', e.message, 'error');
      }
    }
  };

  // --- Edit Handlers ---
  const handleOpenEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setEditName(customer.name);
    setEditPhone(customer.phone);
  };

  const handleUpdate = async () => {
    if (!editingCustomer) return;
    if (!editName.trim() || !editPhone.trim()) {
      window.Swal.fire('Error', 'Nombre y teléfono son obligatorios', 'error');
      return;
    }

    try {
      await updateCustomer(editingCustomer.id, {
        name: editName,
        phone: editPhone
      });
      window.Swal.fire('Actualizado', 'Datos guardados', 'success');
      setEditingCustomer(null);
      fetchCustomers();
    } catch (e: any) {
      window.Swal.fire('Error', e.message, 'error');
    }
  };

  // --- Import Handlers ---
  const handleImport = async () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n');
    const newCustomers: { name: string; phone: string }[] = [];
    
    lines.forEach(line => {
      const parts = line.split(',');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const phone = parts[1].trim();
        if (name && phone) {
          newCustomers.push({ name, phone });
        }
      }
    });

    if (newCustomers.length === 0) {
      window.Swal.fire('Error', 'No se encontraron datos válidos. Usa el formato: Nombre, Telefono', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      await batchImportCustomers(newCustomers);
      window.Swal.fire('Importación Exitosa', `Se procesaron ${newCustomers.length} clientes.`, 'success');
      setImportText('');
      setIsImportModalOpen(false);
      fetchCustomers();
    } catch (e: any) {
      window.Swal.fire('Error', 'Fallo en la importación: ' + e.message, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-coffee-800">Clientes Fidelizados</h2>
          <p className="text-gray-500">Administra tu base de datos y sellos acumulados.</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <div className="relative flex-grow md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-coffee-500 focus:border-transparent transition-shadow shadow-sm"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition flex items-center gap-2 whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Importar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-coffee-600"></div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Teléfono</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Sellos</th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Última Visita</th>
                  <th scope="col" className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                      {searchTerm ? 'No se encontraron clientes con esa búsqueda.' : 'No hay clientes registrados aún.'}
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer, idx) => {
                    // Logic to visually highlight if they can redeem
                    const stamps = customer.stamps || 0;
                    const canRedeem = stamps >= 10;
                    
                    return (
                    <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-lg
                            ${idx === 0 ? 'bg-yellow-500 shadow-md' : 
                              idx === 1 ? 'bg-gray-400' : 
                              idx === 2 ? 'bg-orange-400' : 'bg-coffee-400'}`}>
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{customer.name}</div>
                            {idx < 3 && <span className="text-[10px] text-yellow-600 font-bold">Top #{idx + 1}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {canRedeem ? (
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 animate-pulse">
                                🎁 {stamps} (Canjeable)
                            </span>
                        ) : (
                            <span className="px-3 py-1 inline-flex text-sm leading-5 font-bold rounded-full bg-coffee-100 text-coffee-800 border border-coffee-200">
                                🏅 {stamps}
                            </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-500">
                        {formatDate(customer.lastVisit)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button 
                          onClick={() => handleOpenEdit(customer)}
                          className="text-yellow-600 hover:text-yellow-900 mx-2 p-1 hover:bg-yellow-50 rounded"
                          title="Editar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button 
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600 hover:text-red-900 mx-2 p-1 hover:bg-red-50 rounded"
                          title="Eliminar"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  )})
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- EDIT MODAL --- */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setEditingCustomer(null)} aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Editar Cliente</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nombre</label>
                    <input 
                      type="text" 
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-coffee-500 focus:border-coffee-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                    <input 
                      type="text" 
                      value={editPhone}
                      onChange={e => setEditPhone(e.target.value)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-coffee-500 focus:border-coffee-500 bg-white"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  onClick={handleUpdate}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Guardar
                </button>
                <button 
                  type="button" 
                  onClick={() => setEditingCustomer(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- IMPORT MODAL --- */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => !isImporting && setIsImportModalOpen(false)} aria-hidden="true"></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg font-medium leading-6 text-gray-900 mb-2">Importar Clientes</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Pega tu lista de clientes en formato CSV (Nombre, Teléfono).<br/>
                  Ejemplo:<br/>
                  <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
                    Juan Perez, 999111222<br/>
                    Maria Lopez, 999333444
                  </code>
                </p>
                <textarea 
                  className="w-full h-48 border border-gray-300 rounded-md p-2 text-sm font-mono focus:ring-blue-500 focus:border-blue-500 bg-white"
                  placeholder="Pegar lista aquí..."
                  value={importText}
                  onChange={e => setImportText(e.target.value)}
                  disabled={isImporting}
                ></textarea>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button 
                  type="button" 
                  onClick={handleImport}
                  disabled={isImporting}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none sm:ml-3 sm:w-auto sm:text-sm ${isImporting ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {isImporting ? 'Procesando...' : 'Procesar Lista'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={isImporting}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerList;