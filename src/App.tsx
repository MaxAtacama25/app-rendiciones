import React, { useState, useEffect, useRef } from "react";
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut,
  User as FirebaseUser
} from "firebase/auth";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { 
  Plus, 
  LogOut, 
  Check, 
  X, 
  Search, 
  FileText, 
  LayoutDashboard, 
  History, 
  Users, 
  Settings, 
  AlertCircle, 
  Calendar, 
  DollarSign, 
  Moon, 
  Sun, 
  Filter, 
  Upload, 
  Download, 
  ChevronRight, 
  RefreshCw, 
  AlertTriangle,
  FileCheck,
  CheckCircle,
  FileX,
  XCircle,
  AlertOctagon,
  Eye,
  Trash2,
  Pencil
} from "lucide-react";
import JSZip from "jszip";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { auth, db, googleProvider, handleFirestoreError, OperationType } from "./firebase";
import { UserProfile, Category, Expense } from "./types";
import { compressImage } from "./utils/compressor";

export default function App() {
  // Authentication & Profile States
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  
  // Registration Dialog States
  const [showRegisterConfirm, setShowRegisterConfirm] = useState<boolean>(false);
  const [confirmRut, setConfirmRut] = useState<string>("");
  const [confirmCargo, setConfirmCargo] = useState<string>("");
  const [registerError, setRegisterError] = useState<string>("");

  // Firestore Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  // Settings & Navigation States
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [activeTab, setActiveTab] = useState<string>("dashboard");

  // Date Filter & Search States
  // Initialize start date filter to first day of current month
  const getDefaultStartDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  };
  const [startDateFilter, setStartDateFilter] = useState<string>(getDefaultStartDate());
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Expense Submit Form States
  const [formCategory, setFormCategory] = useState<string>("");
  const [formRut, setFormRut] = useState<string>("");
  const [formVendor, setFormVendor] = useState<string>("");
  const [formDate, setFormDate] = useState<string>("");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formDescription, setFormDescription] = useState<string>("");
  const [fileAttached, setFileAttached] = useState<File | null>(null);
  const [attachedBase64, setAttachedBase64] = useState<string>("");
  const [isOCRProcessing, setIsOCRProcessing] = useState<boolean>(false);
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [ocrStatusMessage, setOcrStatusMessage] = useState<string>("");
  const [ocrErrorMessage, setOcrErrorMessage] = useState<string>("");
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState<string>("");
  const [formErrorMessage, setFormErrorMessage] = useState<string>("");

  // Category Administrator States
  const [newCatName, setNewCatName] = useState<string>("");
  const [newCatDesc, setNewCatDesc] = useState<string>("");
  const [catErrorMessage, setCatErrorMessage] = useState<string>("");

  // Rejection Dialog state
  const [selectedReviewExpense, setSelectedReviewExpense] = useState<Expense | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState<string>("");
  const [rejectionError, setRejectionError] = useState<string>("");
  
  // Selection View details modal state
  const [viewingExpense, setViewingExpense] = useState<Expense | null>(null);
  const [editExpenseId, setEditExpenseId] = useState<string | null>(null);

  // Drag and Drop State
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Load and apply theme inside classList
  useEffect(() => {
    const localTheme = localStorage.getItem("expense_app_theme") as "light" | "dark" | null;
    if (localTheme) {
      setTheme(localTheme);
    } else {
      localStorage.setItem("expense_app_theme", "dark");
      setTheme("dark");
    }
  }, []);

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("expense_app_theme", theme);
  }, [theme]);

  // Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        setProfileLoading(true);
        try {
          // Check if profile exists in firestore
          const docRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            setShowRegisterConfirm(false);
          } else {
            // Profile does not exist, trigger Registration confirmation
            setShowRegisterConfirm(true);
          }
        } catch (err: any) {
          console.error("Error fetching user profile:", err);
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setShowRegisterConfirm(false);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to Firestore Collections depending on Auth and Role
  useEffect(() => {
    if (!user || !profile) return;

    // Listen to Categories (Accessible to all signed-in users)
    const categoriesRef = collection(db, "categories");
    const unsubscribeCategories = onSnapshot(categoriesRef, (snapshot) => {
      const list: Category[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Category);
      });
      setCategories(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "categories");
    });

    // Listen to Users (Only if admin role)
    let unsubscribeUsers = () => {};
    if (profile.role === "admin") {
      const usersRef = collection(db, "users");
      unsubscribeUsers = onSnapshot(usersRef, (snapshot) => {
        const list: UserProfile[] = [];
        snapshot.forEach((doc) => {
          list.push(doc.data() as UserProfile);
        });
        setAllUsers(list);
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, "users");
      });
    }

    // Listen to Expenses (If admin, listen to all. If user, listen to their own)
    const expensesRef = collection(db, "expenses");
    const expenseQuery = profile.role === "admin" 
      ? query(expensesRef, orderBy("createdAt", "desc"))
      : query(expensesRef, where("userId", "==", user.uid), orderBy("createdAt", "desc"));

    const unsubscribeExpenses = onSnapshot(expenseQuery, (snapshot) => {
      const list: Expense[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Expense);
      });
      setExpenses(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, "expenses");
    });

    return () => {
      unsubscribeCategories();
      unsubscribeUsers();
      unsubscribeExpenses();
    };
  }, [user, profile]);

  // Handle Google Sign-In Login with Firebase Auth
  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Google Auth popup failed:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  // Logout routine
  const handleLogout = async () => {
    try {
      await signOut(auth);
      // Reset routing state
      setActiveTab("dashboard");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Submit complete Registration Profile
  const registerProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setRegisterError("");

    if (!confirmRut.trim()) {
      setRegisterError("Por favor ingrese su RUT.");
      return;
    }
    if (!confirmCargo.trim()) {
      setRegisterError("Por favor ingrese su Cargo o Posición.");
      return;
    }

    // Chilean RUT Validator helper
    const cleanRut = confirmRut.replace(/\./g, "").replace(/\s/g, "");
    if (cleanRut.length < 7) {
      setRegisterError("El RUT ingresado no es válido.");
      return;
    }

    // Admin validation rule: maxifireman.mu@gmail.com is authorized as Admin & Approved immediately.
    // Ensure case insensitivity is evaluated
    const isSpecialAdmin = user.email?.toLowerCase().trim() === "maxifireman.mu@gmail.com";
    const userRole: "user" | "admin" = isSpecialAdmin ? "admin" : "user";
    const isApproved: boolean = isSpecialAdmin ? true : false; // Users must wait for administrative verification

    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email?.toLowerCase().trim() || "",
      name: user.displayName || "Usuario Registrado",
      rut: confirmRut.trim(),
      cargo: confirmCargo.trim(),
      role: userRole,
      approved: isApproved,
      createdAt: Timestamp.fromDate(new Date())
    };

    setProfileLoading(true);
    try {
      await setDoc(doc(db, "users", user.uid), newProfile);
      setProfile(newProfile);
      setShowRegisterConfirm(false);
      // Seed categories automatically on first administrative login if empty
      if (isSpecialAdmin) {
        seedDefaultCategories();
      }
    } catch (err: any) {
      console.error("Error creating profile:", err);
      setRegisterError("Error al guardar el perfil en el servidor: " + err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // Category Seeder
  const seedDefaultCategories = async () => {
    const defaults = [
      { id: "alimentacion", name: "Alimentación", description: "Gastos de comidas, colaciones, almuerzos corporativos." },
      { id: "transporte", name: "Transporte", description: "Bencina, peajes, pasajes de avión, micro o taxi corporativo." },
      { id: "servicios", name: "Servicios", description: "Servicios públicos, luz, agua, arriendo de oficinas o hosting." },
      { id: "alojamiento", name: "Alojamiento", description: "Hoteles, cabañas o arriendos temporales en comisiones de servicio." },
      { id: "otros", name: "Otros Gastos", description: "Gastos menores o imprevistas adquisiciones operacionales." }
    ];

    try {
      const catRef = collection(db, "categories");
      const currentSnap = await getDocs(catRef);
      if (currentSnap.empty) {
        for (const item of defaults) {
          await setDoc(doc(db, "categories", item.id), {
            ...item,
            createdAt: Timestamp.fromDate(new Date())
          });
        }
        console.log("Categorías predeterminadas sembradas.");
      }
    } catch (err) {
      console.error("Seeder categories error:", err);
    }
  };

  // Admin approves another user's registration
  const validateUserApproval = async (uid: string, toggleStatus: boolean) => {
    try {
      await updateDoc(doc(db, "users", uid), {
        approved: toggleStatus
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  // Admin manages/adds dynamic expense category
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setCatErrorMessage("");
    if (!newCatName.trim()) {
      setCatErrorMessage("Se requiere el nombre de categoría.");
      return;
    }

    const categoryId = newCatName.toLowerCase().trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[^a-z0-9]/g, "-") // alphanumeric slugifying
      .replace(/-+/g, "-");

    const categoryData: Category = {
      id: categoryId,
      name: newCatName.trim(),
      description: newCatDesc.trim() || "Configurado por el administrador.",
      createdAt: Timestamp.fromDate(new Date())
    };

    try {
      await setDoc(doc(db, "categories", categoryId), categoryData);
      setNewCatName("");
      setNewCatDesc("");
    } catch (err: any) {
      setCatErrorMessage("Fallo al guardar categoría: " + err.message);
    }
  };

  // Admin deletes category
  const handleDeleteCategory = async (catId: string) => {
    if (window.confirm("¿Seguro que desea eliminar esta categoría de consumos?")) {
      try {
        await deleteDoc(doc(db, "categories", catId));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `categories/${catId}`);
      }
    }
  };

  // Drag and Drop upload triggers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFileSelection(e.target.files[0]);
    }
  };

  // Process selected file (Compress and Trigger server OCR request)
  const processFileSelection = async (file: File) => {
    // Basic file validating
    if (!["image/png", "image/jpeg", "image/jpg", "application/pdf"].includes(file.type)) {
      setOcrErrorMessage("Formato de archivo no soportado. Suba sólo imágenes (PNG, JPG) o PDF.");
      return;
    }

    setOcrErrorMessage("");
    setOcrStatusMessage("Preparando archivo y optimizando resolución...");
    setFileAttached(file);

    try {
      // Compress and transform to base64
      const compressedBase64DataUrl = await compressImage(file);
      setAttachedBase64(compressedBase64DataUrl);
      
      // Request server-side OCR via Gemini API proxies
      triggerOCR(compressedBase64DataUrl, file.type);
    } catch (err: any) {
      console.error("Compression failed:", err);
      setOcrErrorMessage("Error al optimizar la imagen: " + err.message);
    }
  };

  // Trigger Gemini API OCR Integration
  const triggerOCR = async (base64String: string, mimeType: string) => {
    setIsOCRProcessing(true);
    setOcrStatusMessage("Iniciando Escáner Óptico de Reconocimiento OCR con Gemini-3.5-Flash...");
    
    // Visual indicators timer rotation
    const statusLogs = [
      "Extrayendo texto del recibo...",
      "Identificando RUT emisor chileno...",
      "Analizando nombre del vendedor y fecha corporativa...",
      "Calculando monto total final de la factura...",
      "Formateando respuesta estructurada de IA..."
    ];
    let counter = 0;
    const interval = setInterval(() => {
      if (counter < statusLogs.length) {
        setOcrStatusMessage(statusLogs[counter++]);
      }
    }, 1800);

    try {
      const response = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64String, mimeType })
      });

      const resText = await response.text();
      if (!response.ok) {
        throw new Error(resText || `Error HTTP ${response.status}`);
      }
      
      let resData;
      try {
        resData = JSON.parse(resText);
      } catch (e) {
        throw new Error("El servidor devolvió una respuesta no válida o vacía.");
      }
      clearInterval(interval);

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "La extracción OCR ha retornado fallo.");
      }

      const ocrResult = resData.data;

      // Update Form State with OCR findings
      setFormRut(ocrResult.rut || "");
      setFormVendor(ocrResult.vendorName || "");
      setFormDate(ocrResult.date || "");
      setFormAmount(ocrResult.totalAmount || 0);
      
      // Auto assign matched category if matches keyword
      const foundCat = categories.find(c => 
        (ocrResult.vendorName && ocrResult.vendorName.toLowerCase().includes(c.name.toLowerCase())) ||
        (ocrResult.vendorName && c.name.toLowerCase().includes(ocrResult.vendorName.toLowerCase()))
      );
      if (foundCat) {
        setFormCategory(foundCat.name);
      } else {
        setFormCategory("");
      }

      setOcrStatusMessage("");
    } catch (err: any) {
      console.error("OCR API error:", err);
      clearInterval(interval);
      setOcrErrorMessage("Error en reconocimiento OCR de Gemini: " + err.message + ". Descuide, puede rellenar los datos manualmente.");
    } finally {
      setIsOCRProcessing(false);
    }
  };

  // Save/Submit complete Expense Claim to Database
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrorMessage("");
    setSubmitSuccessMessage("");

    if (!profile || !user) return;
    if (!profile.approved) {
      setFormErrorMessage("Su cuenta no ha sido validada. No posee autorización para rendir gastos.");
      return;
    }

    if (!formCategory) {
      setFormErrorMessage("Seleccione una clasificado de consumo.");
      return;
    }
    if (!formRut.trim()) {
      setFormErrorMessage("Falta el identificador tributario (RUT).");
      return;
    }
    if (!formVendor.trim()) {
      setFormErrorMessage("Falta el nombre comercial del vendedor.");
      return;
    }
    if (!formDate) {
      setFormErrorMessage("Seleccione la fecha de la transacción.");
      return;
    }
    if (formAmount <= 0) {
      setFormErrorMessage("El monto total del documento debe ser mayor a 0.");
      return;
    }

    const expenseId = `exp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newExpense: Expense = {
      id: expenseId,
      userId: user.uid,
      userName: profile.name,
      userEmail: profile.email,
      category: formCategory,
      rut: formRut.trim(),
      vendorName: formVendor.trim(),
      date: formDate,
      totalAmount: formAmount,
      description: formDescription.trim(),
      receiptBase64: attachedBase64 || undefined,
      status: "pending",
      createdAt: new Date().toISOString()
    };

    try {
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
      setAttachedBase64("");
      
      // Auto transition to history tab
      setTimeout(() => {
        setActiveTab("history");
        setSubmitSuccessMessage("");
      }, 2500);

    } catch (err: any) {
      console.error("Firestore submit error:", err);
      setFormErrorMessage("Error al guardar la rendición en la base de datos: " + err.message);
    }
  };

  // User edits their own rejected expense
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
    if (window.confirm("¿Seguro que desea eliminar esta rendición de gastos permanentemente?")) {
      try {
        await deleteDoc(doc(db, "expenses", expId));
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `expenses/${expId}`);
      }
    }
  };

  // Manager state actions: approve expense
  const handleApproveExpense = async (expense: Expense) => {
    if (!profile) return;
    try {
      await updateDoc(doc(db, "expenses", expense.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: profile.uid
      });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `expenses/${expense.id}`);
    }
  };

  // Manager state actions: Trigger reject dialog
  const handleTriggerReject = (expense: Expense) => {
    setSelectedReviewExpense(expense);
    setRejectionReasonInput("");
    setRejectionError("");
  };

  const handleConfirmRejectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRejectionError("");
    if (!selectedReviewExpense || !profile) return;

    if (!rejectionReasonInput.trim()) {
      setRejectionError("Por favor ingrese el motivo del rechazo del gasto.");
      return;
    }

    try {
      await updateDoc(doc(db, "expenses", selectedReviewExpense.id), {
        status: "rejected",
        rejectionReason: rejectionReasonInput.trim(),
        approvedAt: new Date().toISOString(),
        approvedBy: profile.uid
      });
      setSelectedReviewExpense(null);
      setRejectionReasonInput("");
    } catch (err: any) {
      setRejectionError("Fallo al rechazar rendición: " + err.message);
    }
  };

  // Metrics calculators
  // Filters data according to the "Fecha Inicial" field
  const filterExpensesByStartDate = (list: Expense[]) => {
    if (!startDateFilter) return list;
    return list.filter((exp) => {
      // Compare ISO dates YYYY-MM-DD
      return exp.date >= startDateFilter;
    });
  };

  const filteredExpensesList = filterExpensesByStartDate(expenses);

  const calculateUserDashboardMetrics = () => {
    let r_aprobado = 0;
    let r_rechazado = 0;
    let r_pendiente = 0;

    filteredExpensesList.forEach((exp) => {
      if (exp.status === "approved") {
        r_aprobado += exp.totalAmount;
      } else if (exp.status === "rejected") {
        r_rechazado += exp.totalAmount;
      } else if (exp.status === "pending") {
        r_pendiente += exp.totalAmount;
      }
    });

    return { approved: r_aprobado, rejected: r_rechazado, pending: r_pendiente };
  };

  const metrics = calculateUserDashboardMetrics();

  // Full metrics summary for manager view (all users across system)
  const calculateAdminSystemMetrics = () => {
    let system_aprobado = 0;
    let system_rechazado = 0;
    let system_pendiente = 0;

    // Filters overall system list by start date for admin dashboard overview
    filteredExpensesList.forEach((exp) => {
      if (exp.status === "approved") {
        system_aprobado += exp.totalAmount;
      } else if (exp.status === "rejected") {
        system_rechazado += exp.totalAmount;
      } else if (exp.status === "pending") {
        system_pendiente += exp.totalAmount;
      }
    });

    return { approved: system_aprobado, rejected: system_rechazado, pending: system_pendiente };
  };

  const adminMetrics = calculateAdminSystemMetrics();

  // Filter elements of complete database lists for visual tables (search buscador)
  const getBuscadorFilteredExpenses = () => {
    let base = filteredExpensesList;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      base = base.filter((exp) => 
        exp.vendorName.toLowerCase().includes(q) ||
        exp.rut.toLowerCase().includes(q) ||
        exp.category.toLowerCase().includes(q) ||
        exp.userName.toLowerCase().includes(q) ||
        exp.userEmail.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      base = base.filter((exp) => exp.category.toLowerCase() === categoryFilter.toLowerCase());
    }

    if (statusFilter !== "all") {
      base = base.filter((exp) => exp.status.toLowerCase() === statusFilter.toLowerCase());
    }

    return base;
  };

  const finalBuscadorList = getBuscadorFilteredExpenses();

  // CSV Exporter
  const exportToCSV = () => {
    if (finalBuscadorList.length === 0) {
      alert("No hay registros que coincidan con los filtros de búsqueda para exportar.");
      return;
    }

    // Header defined
    const headers = [
      "ID Rendición",
      "Colaborador",
      "Email Colaborador",
      "Categoría de Consumo",
      "RUT Emisor",
      "Vendedor/Establecimiento",
      "Fecha Reembolso o Compra",
      "Monto Total ($)",
      "Descripción",
      "Estado",
      "Comentario de Rechazo / Aprobación"
    ];

    const csvRows = [headers.join(",")];

    for (const exp of finalBuscadorList) {
      const row = [
        `"${exp.id}"`,
        `"${exp.userName.replace(/"/g, '""')}"`,
        `"${exp.userEmail}"`,
        `"${exp.category}"`,
        `"${exp.rut}"`,
        `"${exp.vendorName.replace(/"/g, '""')}"`,
        `"${exp.date}"`,
        exp.totalAmount,
        `"${exp.description ? exp.description.replace(/"/g, '""').replace(/\n/g, " ") : ""}"`,
        `"${exp.status.toUpperCase()}"`,
        `"${exp.rejectionReason ? exp.rejectionReason.replace(/"/g, '""').replace(/\n/g, " ") : ""}"`
      ];
      csvRows.push(row.join(","));
    }

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rendicion_Gastos_Desde_${startDateFilter || "all"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formats
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(val);
  };

  // Admin Notification Alert Counts
  const pendingNotificationCount = expenses.filter(e => e.status === "pending").length;

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
  const PIE_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef'];

  if (authLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
        <div className="relative flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="mt-4 font-sans text-sm font-medium animate-pulse">Cargando Sistema de Rendición de Gastos...</span>
        </div>
      </div>
    );
  }

  // Visual state fallback: User must authorize inside system first
  if (!user || showRegisterConfirm) {
    return (
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 justify-center items-center p-4">
        {/* Abstract design elements branding card */}
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden p-8 transition-transform duration-300">
          <div className="flex flex-col items-center text-center">
            <div className="mb-6">
              <img src="/logo-cainsa.png" alt="CAINSA SYM" className="h-16 w-auto mx-auto" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              RendicSym Gastos
            </h1>
            <p className="font-sans text-sm text-slate-500 dark:text-slate-400 mt-1 mb-6">
              Plataforma inteligente Corporativa de Rendición de Fondos y OCR
            </p>

            {/* Login Frame view */}
            {!user ? (
              <div className="w-full">
                <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 font-sans">
                  Inicie sesión corporativo de manera fácil utilizando su cuenta autorizada de Google para ingresar gastos, digitalizar comprobantes mediante OCR y ver reembolsos.
                </p>
                <button
                  id="google-login-btn"
                  onClick={handleGoogleLogin}
                  className="w-full flex items-center justify-center gap-3 px-5 py-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 text-slate-700 dark:text-slate-100 font-medium rounded-xl shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-sans cursor-pointer focus:outline-none"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.258-3.133C18.25 1.705 15.42 0 12.24 0 5.48 0 0 5.373 0 12s5.48 12 12.24 12c7.06 0 11.758-4.965 11.758-11.96 0-.807-.087-1.423-.195-1.755H12.24z"
                    />
                  </svg>
                  Identificarse con Google
                </button>
              </div>
            ) : (
              /* Profile details confirmation frame view */
              <form onSubmit={registerProfileSubmit} className="w-full text-left">
                <h3 className="font-sans text-md font-semibold text-slate-800 dark:text-slate-200 mb-2">
                  Confirmación de Registro
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Confirmamos su correo corporativo: <strong className="text-slate-700 dark:text-slate-200">{user.email}</strong>. Por favor complete su RUT y cargo organizacional para habilitar su ficha.
                </p>

                {registerError && (
                  <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-lg text-xs font-sans mb-4 border border-rose-100 dark:border-rose-900">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{registerError}</span>
                  </div>
                )}

                <div className="space-y-4 font-sans text-sm">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                      Identificador RUT
                    </label>
                    <input
                      id="register-rut"
                      type="text"
                      placeholder="12.345.678-9"
                      value={confirmRut}
                      onChange={(e) => setConfirmRut(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                      Cargo o Posición en la Empresa
                    </label>
                    <input
                      id="register-cargo"
                      type="text"
                      placeholder="Ej: Ejecutivo de Proyectos / Ingeniero de Software"
                      value={confirmCargo}
                      onChange={(e) => setConfirmCargo(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-1/3 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-950 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs transition-all cursor-pointer shadow-md shadow-red-500/20"
                  >
                    Confirmar Registro
                  </button>
                </div>
              </form>
            )}
            
            <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-850 w-full text-center">
              <span className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-600 font-mono">
                RendicSym v1.0 • GCP Cloud Infrastructure
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active full application view
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans transition-colors duration-200 flex flex-col">
      
      {/* Top Banner alert count for admins & status alert for new unvalidated profiles */}
      {!profile.approved && (
        <div className="bg-amber-500 text-slate-950 text-center py-2.5 px-4 font-medium text-xs md:text-sm flex items-center justify-center gap-2 shadow-inner">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>Su cuenta normal se encuentra **PENDIENTE DE APROBACIÓN** administrativa. Un administrador debe validar su RUT y cargo antes de poder realizar rendiciones de gastos.</span>
        </div>
      )}

      {/* Primary header navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-40 px-4 py-3 transition-colors duration-200">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-cainsa.png" alt="CAINSA SYM" className="h-8 w-auto" />
            <div>
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">RendicSym</span>
              <span className="text-xs text-red-600 font-mono uppercase bg-red-50 dark:bg-red-950/50 px-1.5 py-0.5 rounded ml-2 font-semibold">
                {profile.role === "admin" ? "Gerencia / Admin" : "Colaborador"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Dark mode switch with notification tag */}
            <div className="relative">
              {profile.role === "admin" && pendingNotificationCount > 0 && (
                <div className="absolute -top-3.5 -right-2 bg-rose-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce shadow border border-white dark:border-slate-900">
                  {pendingNotificationCount} sin aprobar
                </div>
              )}
              <button
                id="theme-toggler-btn"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 focus:outline-none cursor-pointer duration-150"
                title="Cambiar tema visual"
              >
                {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5 text-amber-400" />}
              </button>
            </div>

            {/* Profile badge header */}
            <div className="hidden md:flex flex-col items-end text-neutral-500 font-sans">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{profile.name}</span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">{profile.cargo} • {profile.rut}</span>
            </div>

            <button
              id="header-logout-btn"
              onClick={handleLogout}
              className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg duration-150 cursor-pointer"
              title="Cerrar Sessión"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Navigation Rail sidebar */}
        <nav className="lg:col-span-3 flex flex-row lg:flex-col gap-1.5 bg-white dark:bg-slate-900 p-2 border border-slate-200 dark:border-slate-800 rounded-xl max-h-fit overflow-x-auto lg:overflow-visible transition-colors duration-200">
          <div className="hidden lg:block px-3 py-2 mb-2 text-neutral-400 text-[10px] font-mono tracking-widest uppercase">
            Navegación
          </div>
          
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === "dashboard"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard General
          </button>

          <button
            onClick={() => setActiveTab("submit")}
            className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === "submit"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <Plus className="w-4 h-4" />
            Rendir Nuevo Gasto
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              activeTab === "history"
                ? "bg-red-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
            }`}
          >
            <History className="w-4 h-4" />
            {profile.role === "admin" ? "Historial de Gastos" : "Mis Gastos Rendidos"}
          </button>

          {profile.role === "admin" && (
            <>
              <div className="hidden lg:block border-t border-slate-100 dark:border-slate-850 my-2 pt-2 px-3 text-neutral-400 text-[10px] font-mono tracking-widest uppercase">
                Administración
              </div>

              <button
                onClick={() => setActiveTab("admin-users")}
                className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  activeTab === "admin-users"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Users className="w-4 h-4" />
                Validar Usuarios
                {allUsers.filter(u => !u.approved).length > 0 && (
                  <span className="ml-auto bg-amber-500 text-neutral-950 font-bold text-[9px] px-1.5 py-0.5 rounded">
                    {allUsers.filter(u => !u.approved).length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setActiveTab("admin-categories")}
                className={`w-full flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                  activeTab === "admin-categories"
                    ? "bg-red-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <Settings className="w-4 h-4" />
                Tipos de Consumos
              </button>
            </>
          )}
        </nav>

        {/* Primary workspace layout container */}
        <main className="lg:col-span-9 flex flex-col gap-6">

          {/* 1. DASHBOARD VIEW TAB */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Filter controller: date modifier */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors duration-200">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">Panel de Control de Reembolsos</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Sumarias de reembolsos filtradas por fecha</p>
                </div>

                <div className="flex items-center gap-3 font-sans">
                  <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 px-3 py-1.5 rounded-lg text-xs font-medium">
                    <Calendar className="w-4 h-4 text-red-600" />
                    <span className="text-slate-400">Fecha Inicial:</span>
                    <input
                      id="dashboard-start-date"
                      type="date"
                      value={startDateFilter}
                      onChange={(e) => setStartDateFilter(e.target.value)}
                      className="bg-transparent border-none text-slate-800 dark:text-slate-100 font-semibold focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Stat card boxes based on role */}
              {profile.role === "admin" ? (
                /* Admin system cards */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Global Aprobado</span>
                      <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                      {formatCurrency(adminMetrics.approved)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Monto total reembolsado a colaboradores desde el hito</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Global Pendiente</span>
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/40 text-amber-600 rounded-lg">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-500">
                      {formatCurrency(adminMetrics.pending)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Fondos en revisión de auditoría del emisor</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Global Rechazado</span>
                      <div className="p-2 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg">
                        <XCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-red-600 dark:text-rose-400">
                      {formatCurrency(adminMetrics.rejected)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Rendiciones no procedentes con motivos</p>
                  </div>
                </div>
              ) : (
                /* Contributor system progress cards */
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mis Montos Aprobados</span>
                      <div className="p-2 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-lg">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-red-600 dark:text-red-400">
                      {formatCurrency(metrics.approved)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Fondos acreditados para devolución transferencia</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mis Montos Pendientes</span>
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 rounded-lg">
                        <AlertCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-500">
                      {formatCurrency(metrics.pending)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Rendiciones en cola de validación administrativa</p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:shadow-md transition-all duration-150">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Mis Montos Rechazados</span>
                      <div className="p-2 bg-red-50 dark:bg-red-950/30 text-rose-600 rounded-lg">
                        <XCircle className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                      {formatCurrency(metrics.rejected)}
                    </h3>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Rendiciones desestimadas con justificación</p>
                  </div>
                </div>
              )}

                            {/* Graphic metrics analysis */}
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
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200">
                <h3 className="font-display text-md font-bold text-slate-900 dark:text-white mb-4">Recomendaciones de Rendición con Inteligencia Artificial</h3>
                
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-lg space-y-3 font-sans text-xs flex flex-col gap-2">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span><strong>Reducción de Tiempos OCR:</strong> El motor de OCR procesa con Gemini-3.5-flash sobre comprobantes y detecta nombres comerciales, RUTs del emisor y montos exactos para ahorrar digitación.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span><strong>Imágenes Optimizadas:</strong> El sistema pre-comprime automáticamente cualquier imagen de cámara pesada para no saturar tu banda ancha y resguardar cuotas en la base de datos Firestore.</span>
                  </div>
                  {profile.role === "admin" && (
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <span><strong>Pendientes de Rendición de Gastos:</strong> Hay un total de <strong className="text-rose-600 dark:text-rose-400">{pendingNotificationCount} rendiciones</strong> sin aprobar en su cola de Auditoría.</span>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setActiveTab("submit")}
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs cursor-pointer shadow"
                  >
                    Rendir Nuevo Gasto
                  </button>
                  <button
                    onClick={() => setActiveTab("history")}
                    className="px-3 py-2 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-350 font-medium rounded-lg text-xs hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Ver Bitácora Histórica
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* 2. SUBMIT RECONCILIATION CLAIM WITH OCR */}
          {activeTab === "submit" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200">
              
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Rendir Nuevo Gasto</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Adjunte su boleta (imagen o PDF) para pre-rellenar datos vía OCR inteligente con Gemini.</p>
              </div>

              {!profile.approved ? (
                <div className="p-6 bg-amber-50 dark:bg-amber-950/20 text-center border border-amber-200 rounded-xl space-y-3 font-sans">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h3 className="font-semibold text-sm text-neutral-800 dark:text-neutral-200">Su cuenta no se encuentra aprobada</h3>
                  <p className="text-xs text-neutral-500">Debe esperar que un administrador o gerente valide su registro en el panel para poder enviar informes de gastos.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* Visual Dropzone element */}
                  <div 
                    onDragEnter={handleDrag}
                    onDragOver={handleDrag}
                    onDragLeave={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
                      dragActive 
                        ? "border-red-500 bg-red-50/10" 
                        : "border-slate-200 dark:border-slate-850 hover:border-red-600"
                    }`}
                  >
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                      Arrastre aquí su boleta o factura de compra
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4">
                      Soporta archivos de imagen (.jpg, .png) o archivos PDF (Tamaño máx. 10MB)
                    </span>

                    <input
                      id="expense-file-picker"
                      type="file"
                      accept=".png, .jpeg, .jpg, .pdf"
                      onChange={handleFileInputChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="expense-file-picker"
                      className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs transition duration-150 shadow-md shadow-red-500/10 cursor-pointer"
                    >
                      Seleccionar archivo corporativo
                    </label>

                    {fileAttached && (
                      <div className="mt-4 text-xs font-medium text-red-600 bg-red-50/50 dark:bg-red-950/30 px-3 py-1.5 rounded-lg flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>Archivo adjunto: {fileAttached.name} ({Math.round(fileAttached.size / 1024)} KB)</span>
                      </div>
                    )}
                  </div>

                  {/* OCR loaders or error notices */}
                  {isOCRProcessing && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-850 flex flex-col items-center text-center">
                      <div className="w-8 h-8 border-3 border-red-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">Procesando OCR con Inteligencia Artificial...</span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 animate-pulse">{ocrStatusMessage}</p>
                    </div>
                  )}

                  {ocrErrorMessage && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 text-xs rounded-xl flex items-start gap-2.5 border border-amber-100 dark:border-amber-900 font-sans">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{ocrErrorMessage}</span>
                    </div>
                  )}

                  {submitSuccessMessage && (
                    <div className="p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/30 font-sans text-xs flex items-center gap-2.5">
                      <CheckCircle className="w-5 h-5" />
                      <span>{submitSuccessMessage}</span>
                    </div>
                  )}

                  {formErrorMessage && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 text-xs rounded-xl flex items-start gap-2.5 border border-rose-100 dark:border-rose-900/40 font-sans">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{formErrorMessage}</span>
                    </div>
                  )}

                  {/* Structured Verification Form */}
                  <form onSubmit={handleExpenseSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Clasificación de Consumo / Tipo de Gasto
                        </label>
                        <select
                          id="form-category-select"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none focus:bg-white"
                        >
                          <option value="">-- Seleccionar Categoría --</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          RUT del Vendedor / Emisor del Documento
                        </label>
                        <input
                          id="form-vendor-rut"
                          type="text"
                          placeholder="Rut asignado en la boleta (Ej. 76.123.456-K)"
                          value={formRut}
                          onChange={(e) => setFormRut(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Nombre Fantasía o Razón Social Vendedor
                        </label>
                        <input
                          id="form-vendor-name"
                          type="text"
                          placeholder="Ej: Lider, Copec, Restaurant S.A."
                          value={formVendor}
                          onChange={(e) => setFormVendor(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Fecha de Compra / Emisión
                        </label>
                        <input
                          id="form-transaction-date"
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Monto Total del Documento ($ CLP)
                        </label>
                        <input
                          id="form-total-amount"
                          type="number"
                          placeholder="Monto chileno exacto de la boleta"
                          value={formAmount || ""}
                          onChange={(e) => setFormAmount(Number(e.target.value))}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">
                          Breve Descripción / Propósito del Gasto
                        </label>
                        <input
                          id="form-description-input"
                          type="text"
                          placeholder="Ej: Almuerzo de negocios cliente VIP o Bencina sucursal"
                          value={formDescription}
                          onChange={(e) => setFormDescription(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-red-500 focus:outline-none"
                        />
                      </div>

                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-850">
                      <button
                        type="button"
                        onClick={() => {
                          setFormCategory("");
                          setFormRut("");
                          setFormVendor("");
                          setFormDate("");
                          setFormAmount(0);
                          setFormDescription("");
                          setFileAttached(null);
                          setAttachedBase64("");
                          setOcrErrorMessage("");
                        }}
                        className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer duration-100"
                      >
                        Limpiar Formulario
                      </button>
                      <button
                        type="submit"
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs shadow-md shadow-red-500/10 cursor-pointer"
                      >
                        {editExpenseId ? "Reenviar Rendición" : "Enviar Rendición"}
                      </button>
                    </div>

                  </form>

                </div>
              )}

            </div>
          )}

          {/* 3. HISTORICAL claims LIST WITH SEARCH ENGINE */}
          {activeTab === "history" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200 flex flex-col gap-4">
              
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {profile.role === "admin" ? "Histórico de Rendiciones" : "Mi Bitácora de Gastos"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {profile.role === "admin" ? "Todos los gastos rendidos por colaboradores corporativos" : "Tus reembolsos e informes de rendiciones ingresados"}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs cursor-pointer shadow-sm transition-all"
                    title="Exportar base de datos a planilla"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar CSV
                  </button>
                </div>
              </div>

              {/* Filters / Search ledger box */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200 dark:border-slate-850">
                
                <div className="relative md:col-span-2">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Search className="w-4 h-4" />
                  </span>
                  <input
                    id="ledger-search-input"
                    type="text"
                    placeholder="Buscar vendedor, rut, colaborador, clasificado..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                </div>

                <div>
                  <select
                    id="ledger-category-filter"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">Todas las Categorías</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    id="ledger-status-filter"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="pending">Pendientes</option>
                    <option value="approved">Aprobados</option>
                    <option value="rejected">Rechazados</option>
                  </select>
                </div>

              </div>

              {/* Data Table */}
              <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-xl">
                <table className="w-full text-left font-sans text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider text-[10px] font-mono">
                      {profile.role === "admin" && <th className="p-3">Colaborador</th>}
                      <th className="p-3">Clasificado</th>
                      <th className="p-3">Vendedor / RUT</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Total CLP</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {finalBuscadorList.length === 0 ? (
                      <tr>
                        <td colSpan={profile.role === "admin" ? 7 : 6} className="text-center p-8 text-slate-400">
                          <AlertCircle className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                          <span>No se encontraron rendiciones de gastos registradas con estos filtros.</span>
                        </td>
                      </tr>
                    ) : (
                      finalBuscadorList.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/30 transition-all duration-100">
                          {profile.role === "admin" && (
                            <td className="p-3 font-sans">
                              <span className="font-semibold block text-slate-850 dark:text-white leading-tight">{exp.userName}</span>
                              <span className="text-[10px] text-slate-400 block">{exp.userEmail}</span>
                            </td>
                          )}
                          <td className="p-3">
                            <span className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-medium text-[10px]">
                              {exp.category}
                            </span>
                          </td>
                          <td className="p-3 font-medium">
                            <span className="block text-slate-800 dark:text-slate-200 leading-tight">{exp.vendorName}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{exp.rut}</span>
                          </td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">{exp.date}</td>
                          <td className="p-3 font-semibold text-slate-900 dark:text-neutral-100 font-mono text-xs">
                            {formatCurrency(exp.totalAmount)}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            {exp.status === "pending" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></span>
                                Pendiente
                              </span>
                            )}
                            {exp.status === "approved" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-900/30">
                                <Check className="w-3 h-3" />
                                Aprobado
                              </span>
                            )}
                            {exp.status === "rejected" && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-955/20 px-2 py-0.5 rounded-full border border-red-200 dark:border-rose-900/40">
                                <X className="w-3 h-3" />
                                Rechazado
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Display Details View */}
                              <button
                                onClick={() => setViewingExpense(exp)}
                                className="p-1 px-2 text-[10px] bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 text-slate-600 dark:text-slate-300 font-medium rounded duration-100 flex items-center gap-1 cursor-pointer"
                                title="Ver comprobante y detalles"
                              >
                                <Eye className="w-3 h-3" />
                                Detalles
                              </button>

                              {/* Action buttons for audit admins on PENDING items */}
                              {profile.role === "admin" && exp.status === "pending" && (
                                <>
                                  <button
                                    onClick={() => handleApproveExpense(exp)}
                                    className="p-1 bg-red-500 hover:bg-red-400 text-white rounded cursor-pointer duration-100"
                                    title="Aprobar rendición de fondos"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleTriggerReject(exp)}
                                    className="p-1 bg-red-500 hover:bg-red-400 text-white rounded cursor-pointer duration-100"
                                    title="Rechazar y proveer justificación"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}

                              {/* Edit button for user's own rejected expenses */}
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
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* 4. ADMIN USER MANAGER TO VALIDATE USER REGISTRATIONS */}
          {activeTab === "admin-users" && profile.role === "admin" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200">
              
              <div className="mb-6">
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Validar Usuarios Inscritos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Apruebe o bloquee cuentas de colaboradores antes de que envíen sus rendiciones de gastos.</p>
              </div>

              <div className="overflow-x-auto border border-slate-100 dark:border-slate-850 rounded-xl">
                <table className="w-full text-left font-sans text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-850 text-slate-400 uppercase tracking-wider text-[10px] font-mono">
                      <th className="p-3">Nombre Colaborador</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">RUT</th>
                      <th className="p-3">Cargo / Ficha</th>
                      <th className="p-3">Estado Aprobación</th>
                      <th className="p-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                    {allUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-slate-400">
                          <Users className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                          <span>Cargando planilla de colaboradores...</span>
                        </td>
                      </tr>
                    ) : (
                      allUsers.map((u) => (
                        <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-slate-850/20 duration-100">
                          <td className="p-3 font-semibold text-slate-800 dark:text-neutral-100">{u.name}</td>
                          <td className="p-3 text-slate-500 font-mono text-[11px]">{u.email}</td>
                          <td className="p-3 font-mono text-[11px] text-slate-500">{u.rut}</td>
                          <td className="p-3 font-medium text-slate-650 dark:text-slate-300">{u.cargo}</td>
                          <td className="p-3 whitespace-nowrap">
                            {u.approved ? (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 px-2.5 py-0.5 rounded-full border border-red-200 dark:border-red-900/30">
                                <Check className="w-3 h-3" />
                                Aprobado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/20 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/30">
                                <AlertTriangle className="w-3 h-3" />
                                No Aprobado
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            {u.uid === profile.uid ? (
                              <span className="text-[10px] text-slate-400 italic font-medium px-2">Su cuenta</span>
                            ) : (
                              <button
                                onClick={() => validateUserApproval(u.uid, !u.approved)}
                                className={`px-2 py-1 rounded text-[10px] font-medium duration-100 cursor-pointer ${
                                  u.approved 
                                    ? "bg-amber-500 hover:bg-amber-400 text-slate-950" 
                                    : "bg-red-600 hover:bg-red-500 text-white shadow-sm"
                                }`}
                              >
                                {u.approved ? "Desactivar" : "Aprobar"}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* 5. ADMIN CATEGORIES SETTING MANAGER */}
          {activeTab === "admin-categories" && profile.role === "admin" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 transition-colors duration-200 space-y-6">
              
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Tipos de Consumos o Gastos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Configure las categorías con las cuales los colaboradores clasifican sus reembolsos.</p>
              </div>

              {/* Add New category form */}
              <form onSubmit={handleAddCategory} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aumentar Catálogo de Consumos</h3>
                
                {catErrorMessage && (
                  <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-xs rounded border border-rose-100 dark:border-rose-900">
                    {catErrorMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-sans text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Nombre corporativo de consumo</label>
                    <input
                      id="new-category-name"
                      type="text"
                      placeholder="Ej: Materiales TI, Seguros, Marketing"
                      value={newCatName}
                      onChange={(e) => setNewCatName(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-medium">Descripción corta del rubro</label>
                    <input
                      id="new-category-desc"
                      type="text"
                      placeholder="Ej: Insumos de papelería, cables, pendrives..."
                      value={newCatDesc}
                      onChange={(e) => setNewCatDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-red-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-xs cursor-pointer shadow-sm shadow-red-500/10"
                  >
                    Agregar Tipo de Consumo
                  </button>
                </div>
              </form>

              {/* Lists current active category list */}
              <div className="space-y-3 font-sans">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Consumos Configurados</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categories.map((cat) => (
                    <div key={cat.id} className="p-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-xl flex items-start justify-between shadow-sm">
                      <div>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{cat.name}</span>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{cat.description}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-1 text-slate-350 hover:text-rose-500 rounded duration-100 cursor-pointer"
                        title="Eliminar rubro de consumo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* FOOTER credit brand line */}
      <footer className="mt-12 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-center text-[10px] text-slate-400 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4 font-mono uppercase tracking-widest">
          <span>RendicSym • Rendición de gastos con Inteligencia Artificial</span>
          <span>Google AI Studio Build Sandbox & Cloud Run Services • UTC 2026</span>
        </div>
      </footer>

      {/* 6. MODAL dialog: INDICATE COMMITTED REJECT REASON */}
      {selectedReviewExpense && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl transition-all duration-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2.5 text-neutral-800 dark:text-white">
                <AlertOctagon className="w-5 h-5 text-rose-500" />
                <h3 className="font-display text-md font-bold">Rechazar Rendición de Gasto</h3>
              </div>
              <button
                onClick={() => setSelectedReviewExpense(null)}
                className="text-neutral-400 hover:text-neutral-200 focus:outline-none cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-sans leading-relaxed">
              Está a punto de desestimar el reembolso para el establecimiento <strong className="text-slate-700 dark:text-slate-200">{selectedReviewExpense.vendorName}</strong> ({formatCurrency(selectedReviewExpense.totalAmount)}). Para proceder, es obligatorio que provea una causa o motivo descriptivo.
            </p>

            {rejectionError && (
              <div className="mb-3 p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600 text-[11px] rounded border border-rose-100 dark:border-rose-900 font-sans">
                {rejectionError}
              </div>
            )}

            <form onSubmit={handleConfirmRejectionSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-400 tracking-wider mb-1.5">
                  Motivo o Razón del Rechazo
                </label>
                <textarea
                  id="rejection-reason-textarea"
                  rows={3}
                  placeholder="Ej: La factura no posee el logo tributario correcto, o excede los límites definidos en política para almuerzos corporativos..."
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-850 font-sans">
                <button
                  type="button"
                  onClick={() => setSelectedReviewExpense(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] shadow-md shadow-rose-500/15 cursor-pointer font-semibold"
                >
                  Rechazar Rendición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {/* 7. MODAL dialog: EXPENSE FULL DETAIL INSIGHT AND RECEIPT VISUALIZER */}
      {viewingExpense && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl transition-all duration-200 flex flex-col max-h-[90vh]">
            
            <div className="flex items-start justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-850">
              <div>
                <h3 className="font-display text-md font-bold text-slate-900 dark:text-white">
                  Ficha de Gasto: {viewingExpense.id}
                </h3>
                <span className="text-[10px] uppercase font-mono text-slate-400">
                  Rendida el {new Date(viewingExpense.createdAt?.seconds ? viewingExpense.createdAt.seconds * 1000 : viewingExpense.createdAt || Date.now()).toLocaleDateString("es-CL")}
                </span>
              </div>
              <button
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-1 md:grid-cols-2 gap-5 font-sans">
              
              {/* Left Column: Properties */}
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Colaborador</span>
                  <span className="font-semibold block text-slate-800 dark:text-slate-200">{viewingExpense.userName}</span>
                  <span className="text-[11px] text-slate-500">{viewingExpense.userEmail}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Categoría</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingExpense.category}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Fecha de Compra</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{viewingExpense.date}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Merchant / Comercio</span>
                  <span className="font-semibold block text-slate-800 dark:text-slate-200">{viewingExpense.vendorName}</span>
                  <span className="text-[11px] font-mono text-slate-500">RUT: {viewingExpense.rut}</span>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Monto Rendido</span>
                  <span className="text-lg font-bold text-red-600 dark:text-red-400 font-mono">{formatCurrency(viewingExpense.totalAmount)}</span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-0.5">Glosa / Comentarios de Compra</span>
                  <p className="text-slate-650 dark:text-slate-300 italic">
                    {viewingExpense.description || "N/A - Rendición con comprobante automatizado OCR."}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-850">
                  <span className="text-[10px] uppercase font-mono text-slate-400 block mb-1">Estado de Auditoría</span>
                  {viewingExpense.status === "pending" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900/30">
                      Evaluación Pendiente
                    </span>
                  )}
                  {viewingExpense.status === "approved" && (
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900/30">
                        Aprobado por Administración
                      </span>
                      {viewingExpense.approvedAt && (
                        <p className="text-[10px] text-slate-400 italic">Fecha aprobación: {new Date(viewingExpense.approvedAt).toLocaleString("es-CL")}</p>
                      )}
                    </div>
                  )}
                  {viewingExpense.status === "rejected" && (
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-rose-600 bg-rose-50 dark:bg-rose-955/20 rounded-lg border border-rose-200 dark:border-rose-900/30">
                        Rechazado por Administración
                      </span>
                      <div className="p-3 bg-rose-50/50 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-lg text-rose-700 dark:text-rose-400">
                        <strong className="block mb-0.5 font-sans">Motivo del rechazo:</strong>
                        <span>{viewingExpense.rejectionReason}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Base64 Receipt Visualizer */}
              <div className="flex flex-col border border-slate-150 dark:border-slate-850 bg-slate-50 dark:bg-slate-950 rounded-xl max-h-[350px] md:max-h-[500px] overflow-hidden items-center justify-center p-3 relative text-center">
                {viewingExpense.receiptBase64 ? (
                  viewingExpense.receiptBase64.includes("application/pdf") ? (
                    <div className="flex flex-col items-center p-6 text-slate-400">
                      <FileText className="w-16 h-16 text-red-600 mb-3" />
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Documento de Comprobante PDF</span>
                      <p className="text-[10px] text-slate-400 mt-1">El documento cargado es de tipo PDF. Puedes abrirlo para su revisión completa.</p>
                      <a
                        href={viewingExpense.receiptBase64}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-medium rounded-lg text-[10px] uppercase tracking-wider shadow"
                      >
                        Descargar / Ver PDF
                      </a>
                    </div>
                  ) : (
                    <img
                      src={viewingExpense.receiptBase64}
                      alt="Recibo"
                      className="max-h-full max-w-full object-contain rounded-lg shadow-inner"
                      referrerPolicy="no-referrer"
                    />
                  )
                ) : (
                  <div className="text-slate-400 p-8">
                    <FileX className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                    <span className="text-xs">No se adjuntó comprobante visual.</span>
                  </div>
                )}
              </div>

            </div>

            <div className="flex justify-end mt-4 pt-3 border-t border-slate-100 dark:border-slate-850">
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-xs cursor-pointer"
              >
                Cerrar Ventana
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
