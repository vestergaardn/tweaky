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
