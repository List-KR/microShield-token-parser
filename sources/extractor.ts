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
    const Tokens: string[] = []
    
    let EncoderNodes = FileInstance.getDescendantsOfKind(TsMorph.SyntaxKind.FunctionDeclaration)
      .filter(Descendant => {
        return Descendant.getParent().getChildrenOfKind(TsMorph.SyntaxKind.ExpressionStatement).length > 0
      })
      .filter(EncoderNode => {
        return EncoderNode.getKind() === TsMorph.SyntaxKind.FunctionDeclaration
      })
      .filter(EncoderNode => {
        return EncoderNode.getParent().getChildrenOfKind(TsMorph.SyntaxKind.ExpressionStatement)[0]
        .getChildrenOfKind(TsMorph.SyntaxKind.BinaryExpression).length > 0
      })
      .filter(EncoderNode => {
        return EncoderNode.getFullText().includes('==')
      })
    EncoderNodes = EncoderNodes[0].getParent().getChildrenOfKind(TsMorph.SyntaxKind.FunctionDeclaration)
    const DecoderNode = EncoderNodes.filter(EncoderNode => !EncoderNode.getText().includes('=='))[0]
    const EncoderNode = EncoderNodes.filter(EncoderNode => EncoderNode.getText().includes('=='))[0]
    const MinusNumber = Number(DecoderNode.getFirstDescendantByKind(TsMorph.SyntaxKind.MinusEqualsToken).getParent().getFirstDescendantByKind(TsMorph.SyntaxKind.NumericLiteral).getText())
    let EncoderStringArray: string[] = []
    EncoderNode.getFirstDescendantByKind(TsMorph.SyntaxKind.ArrayLiteralExpression).getDescendantsOfKind(TsMorph.SyntaxKind.StringLiteral).forEach(Child => {
      EncoderStringArray.push(Child.getText().slice(1, -1))
    })
    // Reorder the EncoderStringArray
    const ReorderConditionNode = FileInstance.getDescendantsOfKind(TsMorph.SyntaxKind.IfStatement)
      .filter(IfStatement => {
        return IfStatement.getText().match(/parseInt\(/g)?.length > 8 && IfStatement.getText().includes('break')
      })[0].getFirstDescendantByKind(TsMorph.SyntaxKind.BinaryExpression)
    const ReorderConditionVar = ReorderConditionNode.getDescendantsOfKind(TsMorph.SyntaxKind.Identifier)
      .filter(Identifier => {
        return Identifier.getParent().getDescendantsOfKind(TsMorph.SyntaxKind.NumericLiteral).length === 1 && Identifier.getText() !== 'parseInt'
      })[0].getText()
    while(true) {
      const ReorderConditionResult = new Function('EncoderStringArray', 'MinusNumber', `const ${ReorderConditionVar} = (I) => { return EncoderStringArray[I - MinusNumber] } \n return ${ReorderConditionNode.getText()}`)(EncoderStringArray, MinusNumber)
      if (ReorderConditionResult) {
        break
      }
      EncoderStringArray.push(EncoderStringArray.shift())
    }

    const TokenIdentifierNodes = FileInstance.getDescendantsOfKind(TsMorph.SyntaxKind.Identifier)
      .filter(Identifier => {
        return Identifier.getParent().getDescendantsOfKind(TsMorph.SyntaxKind.Identifier).length === 10
        && typeof Identifier.getFirstAncestorByKind(TsMorph.SyntaxKind.ReturnStatement) !== 'undefined'
        && (Identifier.getFirstAncestorByKind(TsMorph.SyntaxKind.ReturnStatement).getText().includes('.concat([')
        || Identifier.getFirstAncestorByKind(TsMorph.SyntaxKind.ReturnStatement).getText().includes('/resources/')
        || Identifier.getFirstAncestorByKind(TsMorph.SyntaxKind.ReturnStatement).getText().includes('.endpoint'))
      })
    TokenIdentifierNodes.forEach(TokenIdentifier => {
      const TokenDeclarationNode = TokenIdentifier.findReferences()[0].getDefinition().getDeclarationNode()
      if (typeof TokenDeclarationNode.getFirstChildByKind(TsMorph.SyntaxKind.StringLiteral) !== 'undefined') {
        Tokens.push(TokenDeclarationNode.getFirstChildByKind(TsMorph.SyntaxKind.StringLiteral).getText().slice(1, -1))
      } else {
        const CurrentParam = Number(TokenDeclarationNode.getFirstDescendantByKind(TsMorph.SyntaxKind.NumericLiteral).getText())
        Tokens.push(EncoderStringArray[CurrentParam - MinusNumber])
      }
    })

    return Tokens.join('')
  }
}