const fs = require('fs');

let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Add imports
code = code.replace(
  '  Eye\n} from "lucide-react";',
  '  Eye,\n  Trash2,\n  Pencil\n} from "lucide-react";\nimport { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";'
);

// 2. Add state
code = code.replace(
  '  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);',
  '  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);\n  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);'
);

// 3. Update handleExpenseSubmit
const oldSubmitLogic = `    try {
      await setDoc(doc(db, "expenses", expenseId), {
        ...newExpense,
        // Save server timestamp for strict rules compliance
        createdAt: serverTimestamp()
      });

      // Clear Form state upon successful save
      setFormCategory("");
      setFormRut("");
      setFormVendor("");
      setFormDate("");
      setFormAmount(0);
      setFormDescription("");
      setFileAttached(null);
      setAttachedBase64("");
      setSubmitSuccessMessage("Rendición ingresada exitosamente. Se ha listado en su historial para revisión administrativa.");`;

const newSubmitLogic = `    try {
      if (editExpenseId) {
        await updateDoc(doc(db, "expenses", editExpenseId), {
          category: formCategory,
          rut: formRut.trim(),
          vendorName: formVendor.trim(),
          date: formDate,
          totalAmount: formAmount,
          description: formDescription.trim(),
          receiptBase64: attachedBase64 || undefined,
          status: "pending",
          rejectionReason: null,
          approvedAt: null,
          approvedBy: null
        });
        setEditExpenseId(null);
        setSubmitSuccessMessage("Rendición corregida y re-enviada exitosamente a validación.");
      } else {
        await setDoc(doc(db, "expenses", expenseId), {
          ...newExpense,
          createdAt: serverTimestamp()
        });
        setSubmitSuccessMessage("Rendición ingresada exitosamente. Se ha listado en su historial para revisión administrativa.");
      }

      // Clear Form state upon successful save
      setFormCategory("");
      setFormRut("");
      setFormVendor("");
      setFormDate("");
      setFormAmount(0);
      setFormDescription("");
      setFileAttached(null);
      setAttachedBase64("");`;

code = code.replace(oldSubmitLogic, newSubmitLogic);

// 4. Update the submit button text based on edit mode
code = code.replace(
  '>\n                        Enviar Rendición\n                      </button>',
  '>\n                        {editExpenseId ? "Reenviar Rendición" : "Enviar Rendición"}\n                      </button>'
);

// 5. Add handleEditExpense and update handleUserDeleteExpense confirm message
const oldDeleteHandler = `  // User deletes their own pending expense
  const handleUserDeleteExpense = async (expId: string) => {
    if (window.confirm("¿Seguro que desea eliminar esta rendición de gastos pendiente?")) {`;

const newDeleteHandler = `  // User edits their own rejected expense
  const handleEditExpense = (exp: Expense) => {
    setEditExpenseId(exp.id);
    setFormCategory(exp.category);
    setFormRut(exp.rut);
    setFormVendor(exp.vendorName);
    setFormDate(exp.date);
    setFormAmount(exp.totalAmount);
    setFormDescription(exp.description || "");
    setAttachedBase64(exp.receiptBase64 || "");
    setFileAttached(null);
    setActiveTab("submit");
  };

  // User/Admin deletes expense
  const handleUserDeleteExpense = async (expId: string) => {
    if (window.confirm("¿Seguro que desea eliminar esta rendición de gastos permanentemente?")) {`;

code = code.replace(oldDeleteHandler, newDeleteHandler);

// 6. Update chart data logic
const oldNotificationCount = `  const pendingNotificationCount = expenses.filter(e => e.status === "pending").length;`;

const newNotificationCount = `  const pendingNotificationCount = expenses.filter(e => e.status === "pending").length;

  const getCategoryChartData = () => {
    const dataMap: Record<string, number> = {};
    const baseList = profile?.role === "admin" ? filteredExpensesList : filteredExpensesList.filter(e => e.userId === user?.uid);
    baseList.forEach(exp => {
      if (!dataMap[exp.category]) dataMap[exp.category] = 0;
      dataMap[exp.category] += exp.totalAmount;
    });
    return Object.keys(dataMap).map(key => ({ name: key, value: dataMap[key] }));
  };
  const categoryData = getCategoryChartData();
  const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];`;

code = code.replace(oldNotificationCount, newNotificationCount);

// 7. Insert Dashboard Chart UI
const dashboardChartInsertTarget = `{/* Graphic metrics analysis */}`;
const dashboardChartReplacement = `              {/* Graphic metrics analysis */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200 mb-6">
                <h3 className="font-display text-md font-bold text-slate-900 dark:text-white mb-4">Distribución de Gastos por Categoría</h3>
                {categoryData.length > 0 ? (
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => \`\${name} \${(percent * 100).toFixed(0)}%\`}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={\`cell-\${index}\`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip formatter={(value) => formatCurrency(value as number)} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="text-center p-8 text-slate-400 text-xs">No hay datos suficientes para graficar en este periodo.</div>
                )}
              </div>
`;
code = code.replace(dashboardChartInsertTarget, dashboardChartReplacement);

// 8. Update table action buttons (delete & edit)
const oldTableActions = `{/* User can delete their own pending reports */}
                              {profile.role !== "admin" && exp.status === "pending" && (
                                <button
                                  onClick={() => handleUserDeleteExpense(exp.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded duration-100 cursor-pointer"
                                  title="Eliminar registro pendiente"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}`;

const newTableActions = `{/* Edit button for user's own rejected expenses */}
                              {(exp.userId === user.uid && exp.status === "rejected") && (
                                <button
                                  onClick={() => handleEditExpense(exp)}
                                  className="p-1 text-slate-400 hover:text-blue-500 rounded duration-100 cursor-pointer"
                                  title="Editar y Reenviar a Validación"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}

                              {/* Delete button: For users on pending, for Admins on anything */}
                              {(profile.role === "admin" || (exp.userId === user.uid && exp.status === "pending")) && (
                                <button
                                  onClick={() => handleUserDeleteExpense(exp.id)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded duration-100 cursor-pointer"
                                  title="Eliminar rendición permanentemente"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}`;

code = code.replace(oldTableActions, newTableActions);

fs.writeFileSync('src/App.tsx', code);
console.log('App.tsx updated successfully');
