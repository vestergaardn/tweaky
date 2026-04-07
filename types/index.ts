export interface Project {
  id: string
  company_id: string
  name: string
  repo_url: string
  repo_full_name: string
  default_branch: string
  install_command: string
  dev_command: string
  dev_port: number
  script_tag_id: string
  widget_launch_type: "button" | "text-link"
  widget_button_color: string
  widget_button_text: string
  widget_icon_only: boolean
  widget_logo_url: string | null
  widget_welcome_message: string | null
  created_at: string
}

export interface Submission {
  id: string
  project_id: string
  user_prompt: string
  user_email: string
  bounty_amount: number
  pr_url: string | null
  pr_number: number | null
  status: "pending" | "merged" | "rejected"
  created_at: string
}
