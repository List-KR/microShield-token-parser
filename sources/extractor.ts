import * as TsMorph from 'ts-morph'

export class Extractor {
  protected Code: string = ''
  
  constructor(Code: string) {
    this.Code = Code
  }
  
  GetToken(): string {
    const ProjectInstance = new TsMorph.Project({
      compilerOptions: {
        allowJs: true,
        skipLibCheck: true,
        target: TsMorph.ScriptTarget.ES2020
      },
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true
    })
    const FileInstance = ProjectInstance.createSourceFile('code.js', this.Code, { overwrite: true })
    const Tokens: string[] = []
  
    FileInstance.forEachDescendant(CbNode => {
      if (CbNode.getKind() === TsMorph.SyntaxKind.VariableDeclaration) {
        const VariableDeclaration = CbNode.asKind(TsMorph.SyntaxKind.VariableDeclaration)
        const Initalizer = VariableDeclaration.getInitializer()
  
        if (Initalizer && Initalizer.getKind() === TsMorph.SyntaxKind.StringLiteral) {
          const Value = Initalizer.getText().slice(1, -1)
          if (/^eyJ[A-Za-z0-9._-]+$/.test(Value)) {
            VariableDeclaration.findReferencesAsNodes().forEach(Reference => {
              const TokenVars: TsMorph.KindToNodeMappings[TsMorph.ts.SyntaxKind.Identifier][] = []
              Reference.getParent().getChildren().forEach(Child => {
                TokenVars.push(...Child.getChildrenOfKind(TsMorph.SyntaxKind.Identifier))
              })
              TokenVars.forEach(TokenVar => {
                TokenVar.getDefinitions()[0].getDeclarationNode().forEachChild(Child => {
                  if (Child.getKind() === TsMorph.SyntaxKind.StringLiteral) {
                    Tokens.push(Child.getText().slice(1, -1))
                  }
                })
              })
            })
          }
        }
      }
    })
    return Tokens.join('')
  }
}

export class AdvancedExtractor extends Extractor {
  constructor(Code: string) {
    super(Code)
  }

  GetToken(): string {
    const ProjectInstance = new TsMorph.Project({
      compilerOptions: {
        allowJs: true,
        skipLibCheck: true,
        target: TsMorph.ScriptTarget.ES2020
      },
      skipFileDependencyResolution: true,
      useInMemoryFileSystem: true
    })
    const FileInstance = ProjectInstance.createSourceFile('code.js', this.Code, { overwrite: true })
    let StringLiteralsList = FileInstance.getDescendantsOfKind(TsMorph.SyntaxKind.StringLiteral)
    StringLiteralsList = StringLiteralsList.filter(StringLiteral => {
      return StringLiteral.getFullText().includes('token=')
    })
    const TargetedTokenIdentifierList: Array<TsMorph.Identifier> = []
    const TargetedTokenVars: Array<TsMorph.StringLiteral | TsMorph.CallExpression> = []
    const Tokens: string[] = []
    StringLiteralsList.forEach(StringLiteral => {
      StringLiteral.getParent().getParent().forEachChildAsArray().filter(Child => {
        return Child.getFullText().includes('.join(')
      }).forEach(Child => {
        Child.getChildren().forEach(Child => {
          Child.getChildren().forEach(Child => {
            Child.getChildren().forEach(Child => {
              TargetedTokenIdentifierList.push(...Child.getChildrenOfKind(TsMorph.SyntaxKind.Identifier))
            })
          })
        })
      })
    })
    TargetedTokenIdentifierList.forEach(Identifier => {
      Identifier.findReferences().forEach(Reference => {
        TargetedTokenVars.push(...Reference.getDefinition().getDeclarationNode().getChildrenOfKind(TsMorph.SyntaxKind.StringLiteral))
        TargetedTokenVars.push(...Reference.getDefinition().getDeclarationNode().getChildrenOfKind(TsMorph.SyntaxKind.CallExpression))
      })
    })
    TargetedTokenVars.forEach(TargetedTokenVar => {
      if (TargetedTokenVar.isKind(TsMorph.SyntaxKind.StringLiteral)) {
        Tokens.push(TargetedTokenVar.getText().slice(1, -1))
      } else {
        TargetedTokenVar.getChildrenOfKind(TsMorph.SyntaxKind.Identifier).forEach(Identifier => {
          console.log(TrackVars(Identifier).getText())
        })
      }
    })

    return Tokens.join('')
  }
}

function TrackVars(Identifier: TsMorph.Identifier): TsMorph.Node {
  while (true) {
    Identifier.findReferences().forEach(Reference => {
      if (Reference.getDefinition().getDeclarationNode().getChildrenOfKind(TsMorph.SyntaxKind.Identifier).length > 0) {
        Identifier = Reference.getDefinition().getDeclarationNode().getChildrenOfKind(TsMorph.SyntaxKind.Identifier)[0]
      }
    })
    if (Identifier.getKind() === TsMorph.SyntaxKind.Identifier) {
      break
    }
  }
  return Identifier.findReferences()[0].getDefinition().getDeclarationNode()
}