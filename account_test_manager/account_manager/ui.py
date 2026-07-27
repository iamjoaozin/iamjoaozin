import tkinter as tk
from tkinter import filedialog, messagebox, ttk

from .config import DEFAULT_LIMIT, DEFAULT_PASSWORD, DEFAULT_STEP_DELAY_SECONDS, DEFAULT_VERIFY_BROWSER_IP, MAX_LIMIT
from .database import Database
from .local_target import LocalRegistrationServer
from .worker import AccountWorker


class AccountManagerApp:
    def __init__(self) -> None:
        self.database = Database()
        self.server = LocalRegistrationServer(self.database)
        self.worker: AccountWorker | None = None

        self.root = tk.Tk()
        self.root.title("Account Test Manager")
        self.root.geometry("1280x760")
        self.root.minsize(1120, 680)
        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

        self.limit_var = tk.StringVar(value=str(DEFAULT_LIMIT))
        self.password_var = tk.StringVar(value=DEFAULT_PASSWORD)
        self.headless_var = tk.BooleanVar(value=False)
        self.configure_proxy_var = tk.BooleanVar(value=True)
        self.delay_var = tk.StringVar(value=str(DEFAULT_STEP_DELAY_SECONDS))
        self.verify_browser_ip_var = tk.BooleanVar(value=DEFAULT_VERIFY_BROWSER_IP)
        self.extension_path_var = tk.StringVar(value="")
        self.base_profile_path_var = tk.StringVar(value="")
        self.status_var = tk.StringVar(value="Pronto")
        self.proxy_count_var = tk.StringVar(value="Proxies: 0")

        self._build_ui()
        self.server.start()
        self.refresh_data()

    def run(self) -> None:
        self.root.mainloop()

    def _build_ui(self) -> None:
        style = ttk.Style()
        if "clam" in style.theme_names():
            style.theme_use("clam")
        style.configure("Treeview", rowheight=26)
        style.configure("TButton", padding=(12, 7))

        outer = ttk.Frame(self.root, padding=14)
        outer.pack(fill=tk.BOTH, expand=True)

        header = ttk.Frame(outer)
        header.pack(fill=tk.X)

        title = ttk.Label(header, text="Gerenciador local de criacao de contas", font=("Segoe UI", 16, "bold"))
        title.pack(side=tk.LEFT)

        target = ttk.Label(header, text=f"Alvo local: {self.server.base_url}/register")
        target.pack(side=tk.RIGHT)

        controls = ttk.LabelFrame(outer, text="Controle")
        controls.pack(fill=tk.X, pady=(14, 10))

        ttk.Button(controls, text="Importar proxies", command=self.import_proxies).grid(row=0, column=0, padx=8, pady=10)
        ttk.Button(controls, text="Selecionar extensao XPI", command=self.select_extension).grid(
            row=0, column=1, padx=8, pady=10
        )
        ttk.Button(controls, text="Selecionar perfil base", command=self.select_base_profile).grid(
            row=0, column=2, padx=8, pady=10
        )
        ttk.Label(controls, text="Quantidade").grid(row=0, column=3, sticky=tk.W, padx=(18, 4))
        limit_entry = ttk.Spinbox(controls, from_=1, to=MAX_LIMIT, textvariable=self.limit_var, width=5)
        limit_entry.grid(row=0, column=4, sticky=tk.W, padx=(0, 12))

        ttk.Label(controls, text="Senha").grid(row=0, column=5, sticky=tk.W, padx=(8, 4))
        password_entry = ttk.Entry(controls, textvariable=self.password_var, width=18, show="*")
        password_entry.grid(row=0, column=6, sticky=tk.W)

        ttk.Label(controls, text="Atraso (s)").grid(row=0, column=7, sticky=tk.W, padx=(18, 4))
        delay_entry = ttk.Spinbox(controls, from_=0, to=15, increment=0.5, textvariable=self.delay_var, width=6)
        delay_entry.grid(row=0, column=8, sticky=tk.W)

        ttk.Checkbutton(controls, text="Rodar Firefox em segundo plano", variable=self.headless_var).grid(
            row=1, column=6, padx=(18, 0), sticky=tk.W
        )
        ttk.Checkbutton(
            controls,
            text="Configurar proxy no Firefox quando possivel",
            variable=self.configure_proxy_var,
        ).grid(row=1, column=7, columnspan=2, padx=(18, 0), sticky=tk.W)
        ttk.Checkbutton(
            controls,
            text="Verificar IP do navegador antes do cadastro",
            variable=self.verify_browser_ip_var,
        ).grid(row=2, column=3, columnspan=3, padx=(18, 0), pady=(0, 8), sticky=tk.W)

        ttk.Button(controls, text="Iniciar", command=self.start_batch).grid(row=1, column=0, padx=8, pady=(0, 10))
        ttk.Button(controls, text="Pausar", command=self.pause_batch).grid(row=1, column=1, padx=8, pady=(0, 10))
        ttk.Button(controls, text="Retomar", command=self.resume_batch).grid(row=1, column=2, padx=8, pady=(0, 10))
        ttk.Button(controls, text="Parar", command=self.stop_batch).grid(row=1, column=3, padx=8, pady=(0, 10), sticky=tk.W)
        ttk.Button(controls, text="Exportar CSV", command=self.export_csv).grid(
            row=1, column=4, padx=8, pady=(0, 10), sticky=tk.W
        )
        ttk.Button(controls, text="Limpar logs", command=self.clear_logs).grid(
            row=1, column=5, padx=8, pady=(0, 10), sticky=tk.W
        )
        ttk.Label(controls, textvariable=self.proxy_count_var).grid(row=2, column=0, padx=8, pady=(0, 8), sticky=tk.W)
        ttk.Label(controls, textvariable=self.status_var).grid(row=2, column=1, columnspan=2, padx=8, pady=(0, 8), sticky=tk.W)
        ttk.Label(controls, textvariable=self.extension_path_var).grid(
            row=3, column=0, columnspan=9, padx=8, pady=(0, 4), sticky=tk.W
        )
        ttk.Label(controls, textvariable=self.base_profile_path_var).grid(
            row=4, column=0, columnspan=9, padx=8, pady=(0, 8), sticky=tk.W
        )

        controls.columnconfigure(9, weight=1)

        body = ttk.PanedWindow(outer, orient=tk.VERTICAL)
        body.pack(fill=tk.BOTH, expand=True)

        accounts_frame = ttk.LabelFrame(body, text="Contas")
        logs_frame = ttk.LabelFrame(body, text="Logs")
        body.add(accounts_frame, weight=3)
        body.add(logs_frame, weight=2)

        columns = (
            "id",
            "email",
            "proxy",
            "proxy_status",
            "browser_ip",
            "ip_status",
            "container",
            "profile",
            "status",
            "erro",
            "atualizado",
        )
        self.accounts_tree = ttk.Treeview(accounts_frame, columns=columns, show="headings")
        self.accounts_tree.heading("id", text="ID")
        self.accounts_tree.heading("email", text="E-mail")
        self.accounts_tree.heading("proxy", text="Proxy")
        self.accounts_tree.heading("proxy_status", text="Proxy Firefox")
        self.accounts_tree.heading("browser_ip", text="IP navegador")
        self.accounts_tree.heading("ip_status", text="Status IP")
        self.accounts_tree.heading("container", text="Container")
        self.accounts_tree.heading("profile", text="Perfil criado")
        self.accounts_tree.heading("status", text="Status")
        self.accounts_tree.heading("erro", text="Erro")
        self.accounts_tree.heading("atualizado", text="Atualizado")

        self.accounts_tree.column("id", width=60, anchor=tk.CENTER)
        self.accounts_tree.column("email", width=230)
        self.accounts_tree.column("proxy", width=190)
        self.accounts_tree.column("proxy_status", width=250)
        self.accounts_tree.column("browser_ip", width=130)
        self.accounts_tree.column("ip_status", width=280)
        self.accounts_tree.column("container", width=150)
        self.accounts_tree.column("profile", width=260)
        self.accounts_tree.column("status", width=110, anchor=tk.CENTER)
        self.accounts_tree.column("erro", width=220)
        self.accounts_tree.column("atualizado", width=150)

        tree_scroll = ttk.Scrollbar(accounts_frame, orient=tk.VERTICAL, command=self.accounts_tree.yview)
        self.accounts_tree.configure(yscrollcommand=tree_scroll.set)
        self.accounts_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(8, 0), pady=8)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y, padx=(0, 8), pady=8)

        self.logs_text = tk.Text(logs_frame, height=9, wrap=tk.WORD, state=tk.DISABLED, font=("Consolas", 10))
        logs_scroll = ttk.Scrollbar(logs_frame, orient=tk.VERTICAL, command=self.logs_text.yview)
        self.logs_text.configure(yscrollcommand=logs_scroll.set)
        self.logs_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(8, 0), pady=8)
        logs_scroll.pack(side=tk.RIGHT, fill=tk.Y, padx=(0, 8), pady=8)

    def import_proxies(self) -> None:
        path = filedialog.askopenfilename(
            title="Importar proxies",
            filetypes=(("Text files", "*.txt"), ("CSV files", "*.csv"), ("All files", "*.*")),
        )
        if not path:
            return
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            inserted = self.database.import_proxies(handle.readlines())
        self.status_var.set(f"{inserted} proxy(s) importado(s)")
        self.refresh_data()

    def select_extension(self) -> None:
        path = filedialog.askopenfilename(
            title="Selecionar extensao Firefox (.xpi)",
            filetypes=(("Firefox extensions", "*.xpi"), ("All files", "*.*")),
        )
        if not path:
            return
        self.extension_path_var.set(path)
        self.status_var.set("Extensao selecionada")

    def select_base_profile(self) -> None:
        path = filedialog.askdirectory(title="Selecionar perfil base do Firefox")
        if not path:
            return
        self.base_profile_path_var.set(path)
        self.status_var.set("Perfil base selecionado")

    def start_batch(self) -> None:
        if self.worker and self.worker.is_alive():
            messagebox.showinfo("Fila em execucao", "Ja existe um lote em execucao.")
            return

        try:
            limit = int(self.limit_var.get())
        except ValueError:
            messagebox.showerror("Quantidade invalida", f"Informe um numero entre 1 e {MAX_LIMIT}.")
            return

        limit = max(1, min(limit, MAX_LIMIT))
        self.limit_var.set(str(limit))
        password = self.password_var.get().strip()
        if not password:
            messagebox.showerror("Senha obrigatoria", "Informe uma senha para o teste.")
            return
        try:
            step_delay_seconds = float(self.delay_var.get().replace(",", "."))
        except ValueError:
            messagebox.showerror("Atraso invalido", "Informe um numero em segundos, por exemplo 3 ou 4.5.")
            return

        self.worker = AccountWorker(
            database=self.database,
            target_base_url=self.server.base_url,
            limit=limit,
            password=password,
            headless=self.headless_var.get(),
            configure_proxy=self.configure_proxy_var.get(),
            extension_xpi_path=self.extension_path_var.get().strip() or None,
            step_delay_seconds=step_delay_seconds,
            base_profile_dir=self.base_profile_path_var.get().strip() or None,
            verify_browser_ip=self.verify_browser_ip_var.get(),
            on_change=lambda: self.root.after(0, self.refresh_data),
        )
        self.worker.start()
        self.status_var.set("Lote iniciado")

    def pause_batch(self) -> None:
        if self.worker and self.worker.is_alive():
            self.worker.pause()
            self.status_var.set("Pausado")

    def resume_batch(self) -> None:
        if self.worker and self.worker.is_alive():
            self.worker.resume()
            self.status_var.set("Executando")

    def stop_batch(self) -> None:
        if self.worker and self.worker.is_alive():
            self.worker.stop()
            self.status_var.set("Parando")

    def export_csv(self) -> None:
        path = filedialog.asksaveasfilename(
            title="Exportar contas",
            defaultextension=".csv",
            filetypes=(("CSV files", "*.csv"), ("All files", "*.*")),
        )
        if not path:
            return
        self.database.export_accounts_csv(path)
        self.status_var.set(f"Exportado: {path}")

    def clear_logs(self) -> None:
        if not messagebox.askyesno("Limpar logs", "Apagar todos os logs salvos?"):
            return
        self.database.clear_logs()
        self.status_var.set("Logs limpos")
        self.refresh_data()

    def refresh_data(self) -> None:
        self.proxy_count_var.set(f"Proxies: {self.database.count_proxies()}")

        for item in self.accounts_tree.get_children():
            self.accounts_tree.delete(item)

        for row in self.database.get_accounts():
            self.accounts_tree.insert(
                "",
                tk.END,
                values=(
                    row["id"],
                    row["email"],
                    row["proxy"] or "-",
                    row["proxy_status"] or "-",
                    row["browser_ip"] or "-",
                    row["ip_check_status"] or "-",
                    row["container_name"],
                    row["profile_path"] or "-",
                    row["status"],
                    row["error_message"] or "",
                    row["updated_at"],
                ),
            )

        logs = self.database.get_recent_logs(150)
        self.logs_text.configure(state=tk.NORMAL)
        self.logs_text.delete("1.0", tk.END)
        for row in reversed(logs):
            account = f"#{row['account_id']} " if row["account_id"] else ""
            self.logs_text.insert(tk.END, f"{row['created_at']} [{row['level']}] {account}{row['message']}\n")
        self.logs_text.configure(state=tk.DISABLED)
        self.logs_text.see(tk.END)

        self.root.after(1000, self.refresh_data)

    def on_close(self) -> None:
        if self.worker and self.worker.is_alive():
            self.worker.stop()
        self.server.stop()
        self.root.destroy()


def main() -> None:
    app = AccountManagerApp()
    app.run()
