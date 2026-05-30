with open('template.yaml', 'r') as f:
    content = f.read()

old = """Globals:
  Function:
    Runtime: nodejs20.x"""

new = """Globals:
  Api:
    Auth:
      DefaultAuthorizer: NONE
      AddDefaultAuthorizerToCorsPreflight: false
  HttpApi:
    Auth:
      DefaultAuthorizer: NONE
  Function:
    Runtime: nodejs20.x"""

content = content.replace(old, new)

with open('template.yaml', 'w') as f:
    f.write(content)

print("Done!")
